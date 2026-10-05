import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  applyAction,
  normaliseEmail,
  prepareSeedState,
  registerCognitoUser,
  safeUser,
  stateForActor
} from './domain.mjs';
import {
  createStateIfMissing,
  loadState,
  replaceState,
  StateConflictError
} from './store.mjs';
import {
  handleCognitoEmailNotification,
  isCognitoEmailNotificationEvent
} from './snsNotifications.mjs';

const TABLE_NAME = process.env.TABLE_NAME;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET;
const USER_POOL_ID = process.env.USER_POOL_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-2';
const s3 = new S3Client({});

let rawSeedPromise;

function rawSeed() {
  rawSeedPromise ||= readFile(new URL('./seed.json', import.meta.url), 'utf8').then(JSON.parse);
  return rawSeedPromise;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function preflightResponse() {
  return {
    statusCode: 204,
    headers: {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-max-age': '300'
    },
    body: ''
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (Buffer.byteLength(raw) > 128 * 1024) throw new Error('Request body is too large.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function statusForError(error) {
  if (/Authentication required|session token|session has expired/i.test(error.message)) return 401;
  if (/Administrator access required|cannot edit|cannot delete|not a participant/i.test(error.message)) return 403;
  if (/not found/i.test(error.message)) return 404;
  if (/state changed|try again/i.test(error.message)) return 409;
  return 400;
}

function claimsFromEvent(event, { optional = false } = {}) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    if (optional) return null;
    throw new Error('Authentication required.');
  }
  const rawGroups = claims['cognito:groups'];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : String(rawGroups || '').replace(/[\[\]"]/g, '').split(/[,\s]+/).filter(Boolean);
  return {
    sub: String(claims.sub),
    email: normaliseEmail(claims.email),
    name: String(claims.name || '').trim(),
    groups
  };
}

function roleFromClaims(claims) {
  return claims.groups.includes('Admins') ? 'admin' : 'user';
}

function actorFromEvent(event, state, { optional = false } = {}) {
  const claims = claimsFromEvent(event, { optional });
  if (!claims) return null;
  const actor = state.users.find((user) => (
    user.cognitoSub === claims.sub
    || normaliseEmail(user.email) === claims.email
  ));
  if (!actor || actor.status !== 'active') throw new Error('Authentication required.');
  return actor;
}

async function mutateWithRetry(mutator) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const loaded = await loadState(TABLE_NAME);
    if (!loaded) throw new Error('E-Swap has not been initialised.');
    const outcome = await mutator(loaded.state);
    try {
      const version = await replaceState(TABLE_NAME, loaded.state, loaded.version);
      return { ...outcome, state: loaded.state, version };
    } catch (error) {
      if (!(error instanceof StateConflictError) || attempt === 3) throw error;
    }
  }
  throw new StateConflictError();
}

async function initialiseState() {
  const prepared = await prepareSeedState(await rawSeed());
  await createStateIfMissing(TABLE_NAME, prepared);

  await mutateWithRetry(async (state) => {
    state.meta ||= {};
    state.meta.schemaVersion = '2.2.0-cognito';
    state.meta.storage = 'dynamodb';
    state.meta.authentication = 'amazon-cognito';
    for (const user of state.users) {
      delete user.password;
      delete user.passwordHash;
      delete user.passwordSalt;
    }
    return { migrated: true };
  });
}

async function initialiseManualState() {
  const prepared = await prepareSeedState(await rawSeed());
  const created = await createStateIfMissing(TABLE_NAME, prepared);
  return {
    statusCode: created ? 201 : 200,
    body: JSON.stringify({
      service: 'e-swap-2.2-api',
      status: created ? 'initialised' : 'already-initialised',
      storage: 'dynamodb'
    })
  };
}

async function cfnResponse(event, context, status, reason) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason || `See CloudWatch log stream ${context.logStreamName}`,
    PhysicalResourceId: event.PhysicalResourceId || 'E-Swap-Seed-State',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: {}
  });
  await fetch(event.ResponseURL, {
    method: 'PUT',
    headers: { 'content-type': '', 'content-length': String(Buffer.byteLength(body)) },
    body
  });
}

async function handleCustomResource(event, context) {
  try {
    if (event.RequestType !== 'Delete') await initialiseState();
    await cfnResponse(event, context, 'SUCCESS');
  } catch (error) {
    console.error('Custom resource failed', error);
    await cfnResponse(event, context, 'FAILED', error.message);
  }
  return {};
}

async function handleSession(event) {
  const claims = claimsFromEvent(event);
  const values = parseBody(event);
  const profile = values.profile || {};
  const outcome = await mutateWithRetry(async (state) => {
    state.meta ||= {};
    state.meta.schemaVersion = '2.2.0-cognito';
    state.meta.storage = 'dynamodb';
    state.meta.authentication = 'amazon-cognito';
    for (const user of state.users) {
      delete user.password;
      delete user.passwordHash;
      delete user.passwordSalt;
    }
    const userId = registerCognitoUser(state, {
      cognitoSub: claims.sub,
      email: claims.email,
      name: claims.name || profile.name || claims.email.split('@')[0],
      location: profile.location,
      role: roleFromClaims(claims)
    });
    return { userId };
  });
  const user = outcome.state.users.find((entry) => entry.id === outcome.userId);
  if (!user || user.status === 'suspended') throw new Error('This account is suspended. Contact an administrator.');
  if (user.status === 'deleted') throw new Error('This account has been deleted.');
  return response(200, {
    user: safeUser(user),
    state: stateForActor(outcome.state, user.id),
    version: outcome.version
  });
}

async function handleAction(event) {
  const body = parseBody(event);
  if (!body.action) throw new Error('Action is required.');
  const idempotencyKey = String(body.idempotencyKey || randomUUID());
  const firstLoad = await loadState(TABLE_NAME);
  if (!firstLoad) throw new Error('E-Swap has not been initialised.');
  const initialActor = actorFromEvent(event, firstLoad.state);
  const actorId = initialActor.id;
  const actorRole = roleFromClaims(claimsFromEvent(event));

  const outcome = await mutateWithRetry(async (state) => {
    const actor = state.users.find((user) => user.id === actorId && user.status === 'active');
    if (!actor) throw new Error('Authentication required.');
    actor.role = actorRole;
    state.meta.processedActionIds ||= [];
    const previous = state.meta.processedActionIds.find((entry) => entry.id === idempotencyKey && entry.actorId === actorId);
    if (previous) return { result: previous.result };

    let result;
    if (body.action === 'resetDemo') {
      if (actor.role !== 'admin') throw new Error('Administrator access required.');
      const replacement = await prepareSeedState(await rawSeed());
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, replacement);
      result = true;
    } else {
      result = await applyAction(state, actorId, body.action, body.payload || {});
    }

    state.meta.processedActionIds ||= [];
    state.meta.processedActionIds.push({
      id: idempotencyKey,
      action: body.action,
      actorId,
      result: result ?? null,
      createdAt: new Date().toISOString()
    });
    state.meta.processedActionIds = state.meta.processedActionIds.slice(-200);
    return { result };
  });

  const activeActor = outcome.state.users.find((user) => user.id === actorId && user.status === 'active');
  return response(200, {
    result: outcome.result,
    state: stateForActor(outcome.state, activeActor?.id || null),
    signedOut: !activeActor,
    version: outcome.version
  });
}

async function handleUpload(event) {
  const body = parseBody(event);
  const loaded = await loadState(TABLE_NAME);
  if (!loaded) throw new Error('E-Swap has not been initialised.');
  const actor = actorFromEvent(event, loaded.state);
  const contentType = String(body.contentType || '').toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Only JPG, PNG and WebP images are supported.');
  }
  const original = String(body.fileName || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
  const key = `uploads/${actor.id}/${randomUUID()}-${original}`;
  const command = new PutObjectCommand({
    Bucket: IMAGE_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
  return response(200, { uploadUrl, publicUrl, expiresIn: 300 });
}

async function handleHttp(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/';

  if (method === 'OPTIONS') return preflightResponse();
  if (method === 'GET' && path === '/health') {
    const loaded = await loadState(TABLE_NAME);
    return response(200, {
      service: 'e-swap-2.2-api',
      status: loaded ? 'ok' : 'initialising',
      storage: 'dynamodb',
      region: AWS_REGION
    });
  }
  if (method === 'GET' && path === '/public-state') {
    const loaded = await loadState(TABLE_NAME);
    if (!loaded) throw new Error('E-Swap has not been initialised.');
    return response(200, { state: stateForActor(loaded.state), version: loaded.version });
  }
  if (method === 'GET' && path === '/state') {
    const loaded = await loadState(TABLE_NAME);
    if (!loaded) throw new Error('E-Swap has not been initialised.');
    const actor = actorFromEvent(event, loaded.state);
    return response(200, { state: stateForActor(loaded.state, actor.id), version: loaded.version });
  }
  if (method === 'POST' && path === '/auth/session') return handleSession(event);
  if (method === 'POST' && path === '/actions') return handleAction(event);
  if (method === 'POST' && path === '/uploads/presign') return handleUpload(event);
  return response(404, { error: 'Route not found.' });
}

export async function handler(event, context) {
  if (isCognitoEmailNotificationEvent(event)) return handleCognitoEmailNotification(event);
  if (event?.operation === 'INITIALISE_ESWAP_STATE' && !event?.requestContext) {
    return initialiseManualState();
  }
  if (event.RequestType && event.ResponseURL) return handleCustomResource(event, context);
  try {
    return await handleHttp(event);
  } catch (error) {
    console.error('Request failed', {
      name: error.name,
      message: error.message,
      requestId: context?.awsRequestId
    });
    return response(statusForError(error), { error: error.message || 'Request failed.' });
  }
}
