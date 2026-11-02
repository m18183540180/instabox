const BASE = '/api';

async function request(method, path, body, apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      (data.error && (data.error.message || data.error.code)) ||
      data.message ||
      `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export const listMachines = async (k) => {
  const d = await request('GET', '/machines', undefined, k);
  const items = d.machines || d.items || [];
  return { items, hasMore: Boolean(d.nextCursor), nextCursor: d.nextCursor };
};
export const getMachine = (k, id) => request('GET', `/machines/${id}`, undefined, k);
export const deleteMachine = (k, id) => request('DELETE', `/machines/${id}`, undefined, k);
export const lifecycle = (k, id, action) => request('POST', `/machines/${id}/${action}`, {}, k);
export const execCommand = (k, id, cmd) => request('POST', `/machines/${id}/exec`, { cmd }, k);
export const getOperation = (k, opId) => request('GET', `/operations/${opId}`, undefined, k);
export const getMetrics = (k, id) => request('GET', `/machines/${id}/metrics`, undefined, k);

export const listPorts = (k, id) => request('GET', `/machines/${id}/ports`, undefined, k);
export const publishPort = (k, id, body) => request('POST', `/machines/${id}/ports`, body, k);
export const removePort = (k, id, port) => request('DELETE', `/machines/${id}/ports/${port}`, undefined, k);

export const getConnectionInfo = (k, id) => request('GET', `/machines/${id}/connection-info`, undefined, k);
export const createSshToken = (k, id) => request('POST', `/machines/${id}/ssh-tokens`, {}, k);
export const revokeSshTokens = (k, id) => request('DELETE', `/machines/${id}/ssh-tokens`, undefined, k);
