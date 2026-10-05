const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request(path, { method = 'GET', token = '', body } = {}) {
  if (!API_URL) throw new Error('VITE_API_URL is not configured.');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('Could not reach the E-Swap AWS API. Check the API URL and your internet connection.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `AWS request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const awsApi = {
  getPublicState() {
    return request('/public-state');
  },
  getState(token) {
    return request('/state', { token });
  },
  openSession(token, profile = {}) {
    return request('/auth/session', {
      method: 'POST',
      token,
      body: { profile, requestId: requestId() }
    });
  },
  action(token, action, payload = {}) {
    return request('/actions', {
      method: 'POST',
      token,
      body: { action, payload, idempotencyKey: requestId() }
    });
  },
  presignUpload(token, file) {
    return request('/uploads/presign', {
      method: 'POST',
      token,
      body: { fileName: file.name, contentType: file.type }
    });
  },
  async uploadImage(token, file) {
    const signed = await this.presignUpload(token, file);
    const upload = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file
    });
    if (!upload.ok) throw new Error('The image could not be uploaded to S3.');
    return signed.publicUrl;
  }
};
