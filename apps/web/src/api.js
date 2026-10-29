async function send(url, options, stage) {
  try {
    return await fetch(url, { credentials: 'same-origin', ...options });
  } catch (cause) {
    throw new Error(
      stage === 'csrf'
        ? 'No se pudo conectar para verificar la sesión. Comprobá tu conexión, recargá la página e intentá nuevamente.'
        : options.body instanceof FormData
          ? 'No se pudo enviar la foto al servidor. Comprobá tu conexión y volvé a seleccionar el archivo descargado en tu teléfono. Antes de reintentar, actualizá la lista para comprobar si se guardó.'
          : 'Se interrumpió la conexión con el servidor. Comprobá tu conexión y recargá la página.',
      { cause },
    );
  }
}
async function readJson(response) {
  try {
    return await response.json();
  } catch (cause) {
    throw new Error(
      `El servidor no devolvió una respuesta válida (HTTP ${response.status}). Actualizá la lista antes de reintentar.`,
      { cause },
    );
  }
}
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // The browser must generate the multipart boundary. Never set Content-Type
  // manually for FormData or retry a mutation automatically.
  if (options.method && options.method !== 'GET') {
    const response = await send('/api/csrf', { cache: 'no-store' }, 'csrf');
    if (!response.ok) throw new Error('No se pudo establecer la sesión');
    const data = await readJson(response);
    if (typeof data.token !== 'string' || !data.token) {
      throw new Error('No se pudo verificar la sesión. Recargá la página.');
    }
    headers.set('x-csrf-token', data.token);
  }
  const response = await send(
    '/api' + path,
    { ...options, headers },
    'request',
  );
  if (response.status === 204) return null;
  const data = await readJson(response);
  if (!response.ok) {
    const reference = response.headers.get('x-request-id');
    throw new Error(
      (data.message || 'No se pudo conectar') +
        (reference ? ` Referencia: ${reference}.` : ''),
    );
  }
  return data;
}
