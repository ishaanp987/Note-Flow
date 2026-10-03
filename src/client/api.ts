let token = '';
export async function initialize() {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error('The local app is unavailable. Restart Lecture Notes.');
  token = (await res.json()).token;
}
export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, { method, headers: { 'Content-Type': 'application/json', 'X-Lecture-Token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'The local request failed.' })); throw new Error(err.error); }
  return res.json();
}
export async function upload(url: string, data: Blob, name = '') {
  const res = await fetch(`/api${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-Lecture-Token': token, 'X-Audio-Name': encodeURIComponent(name) }, body: data });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: 'Audio could not be saved.' }))).error);
  return res.json();
}
