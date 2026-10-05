import test from 'node:test';
import assert from 'node:assert/strict';
import { seedDatabase } from '../../../frontend/src/data/seed.js';
import {
  applyAction,
  prepareSeedState,
  registerCognitoUser,
  stateForActor
} from '../src/domain.mjs';

async function seeded() {
  return prepareSeedState(seedDatabase);
}

test('Cognito seed state contains no password material', async () => {
  const state = await seeded();
  const admin = state.users.find((user) => user.id === 'usr-admin');
  assert.equal(admin.password, undefined);
  assert.equal(admin.passwordHash, undefined);
  assert.equal(admin.passwordSalt, undefined);
  assert.equal(state.meta.authentication, 'amazon-cognito');
});

test('public state exposes trust details but no private account data', async () => {
  const state = await seeded();
  const publicState = stateForActor(state);
  const alex = publicState.users.find((user) => user.id === 'usr-alex');
  assert.equal(alex.name, 'Alex Johnson');
  assert.equal(alex.joinedAt, '2026-06-18T10:30:00.000Z');
  assert.equal(alex.email, undefined);
  assert.equal(alex.tokenBalance, undefined);
  assert.equal(alex.blockedUserIds, undefined);
  assert.ok(publicState.reviews.some((review) => review.targetUserId === 'usr-alex'));
  assert.ok(publicState.reviews.every((review) => review.orderId === undefined));
});

test('Cognito registration links a subject and creates the starter wallet transaction', async () => {
  const state = await seeded();
  const id = registerCognitoUser(state, {
    name: 'New User',
    email: 'NEW@example.com',
    cognitoSub: 'cognito-sub-123',
    location: 'Coventry'
  });
  const user = state.users.find((entry) => entry.id === id);
  assert.equal(user.email, 'new@example.com');
  assert.equal(user.tokenBalance, 100);
  assert.equal(user.cognitoSub, 'cognito-sub-123');
  assert.equal(user.passwordHash, undefined);
  assert.ok(state.transactions.some((entry) => entry.userId === id && entry.type === 'signup_reward'));
});

test('Cognito Admins group mapping can create and promote an administrator', async () => {
  const state = await seeded();
  const id = registerCognitoUser(state, {
    name: 'Platform Supervisor',
    email: 'supervisor@example.com',
    cognitoSub: 'admin-sub-123',
    role: 'admin'
  });
  assert.equal(state.users.find((entry) => entry.id === id).role, 'admin');
  registerCognitoUser(state, {
    name: 'Platform Supervisor',
    email: 'supervisor@example.com',
    cognitoSub: 'admin-sub-123',
    role: 'user'
  });
  assert.equal(state.users.find((entry) => entry.id === id).role, 'user');
});

test('admin escrow release is atomic at the domain boundary and cannot run twice', async () => {
  const state = await seeded();
  const sellerBefore = state.users.find((user) => user.id === 'usr-sarah').tokenBalance;
  await applyAction(state, 'usr-admin', 'adminProcessEscrow', {
    orderId: 'ord-ipad',
    outcome: 'release',
    reason: 'Administrator verified collection evidence.'
  });
  const order = state.orders.find((entry) => entry.id === 'ord-ipad');
  const seller = state.users.find((user) => user.id === 'usr-sarah');
  assert.equal(order.escrowStatus, 'released');
  assert.equal(seller.tokenBalance, sellerBefore + 300);
  assert.match(order.escrowDecision.reason, /verified collection/);
  assert.ok(state.auditLog.some((entry) => entry.action === 'ADMIN_ESCROW_RELEASED' && entry.metadata.orderId === 'ord-ipad'));
  await assert.rejects(
    () => applyAction(state, 'usr-admin', 'adminProcessEscrow', {
      orderId: 'ord-ipad',
      outcome: 'refund',
      reason: 'Attempted duplicate.'
    }),
    /Duplicate token release or refund was blocked/
  );
  assert.equal(seller.tokenBalance, sellerBefore + 300);
});

test('ordinary users cannot run administrator actions', async () => {
  const state = await seeded();
  await assert.rejects(
    () => applyAction(state, 'usr-alex', 'adminAdjustTokens', {
      userId: 'usr-alex',
      amount: 500,
      reason: 'Not allowed'
    }),
    /Administrator access required/
  );
});

test('recycling transitions require admin notes and follow the workflow', async () => {
  const state = await seeded();
  await assert.rejects(
    () => applyAction(state, 'usr-admin', 'adminUpdateRecyclingRequest', {
      requestId: 'rec-alex-dell',
      status: 'approved',
      reason: ''
    }),
    /mandatory/
  );
  await applyAction(state, 'usr-admin', 'adminUpdateRecyclingRequest', {
    requestId: 'rec-alex-dell',
    status: 'approved',
    reason: 'Approved for collection at the recycling point.'
  });
  await applyAction(state, 'usr-admin', 'adminUpdateRecyclingRequest', {
    requestId: 'rec-alex-dell',
    status: 'completed',
    reason: 'Device received and processed.'
  });
  const request = state.recyclingRequests.find((entry) => entry.id === 'rec-alex-dell');
  assert.equal(request.status, 'completed');
  assert.equal(request.history.at(-1).status, 'completed');
});

test('regular state is scoped while admin can inspect all conversations', async () => {
  const state = await seeded();
  const userState = stateForActor(state, 'usr-alex');
  const adminState = stateForActor(state, 'usr-admin');
  assert.ok(userState.conversations.every((conversation) => conversation.participantIds.includes('usr-alex')));
  assert.equal(adminState.conversations.length, state.conversations.length);
  assert.equal(adminState.messages.length, state.messages.length);
  assert.ok(adminState.users.every((user) => !('passwordHash' in user)));
  assert.equal(userState.auditLog.length, 0);
});
