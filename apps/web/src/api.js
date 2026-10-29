export async function api(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' };
  if (options.method && options.method !== 'GET') {
    const response = await fetch('/api/csrf');
    if (!response.ok) throw new Error('No se pudo establecer la sesión');
    headers['x-csrf-token'] = (await response.json()).token;
  }
  const response = await fetch('/api' + path, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudo conectar');
  return data;
}
