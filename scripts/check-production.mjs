const raw = process.env.APP_ORIGIN;
if (!raw) throw new Error('Configurá APP_ORIGIN con la URL del sitio.');
const origin = new URL(raw);
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/'
)
  throw new Error(
    'APP_ORIGIN debe ser un origen HTTPS sin credenciales ni rutas.',
  );
for (const path of [
  '/api/ready',
  '/api/health',
  '/api/auth/options',
  '/api/products?page=1',
]) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const data = await response.json();
  if (path === '/api/ready' && data.status !== 'ready')
    throw new Error('La base de datos no está lista.');
  if (path === '/api/health' && data.status !== 'ok')
    throw new Error('El servidor no está listo.');
  if (
    path.startsWith('/api/products') &&
    (!Array.isArray(data.products) || data.products.length > 20)
  )
    throw new Error(
      'La respuesta del catálogo no corresponde a la versión paginada.',
    );
  console.log(
    JSON.stringify({
      event: 'production_check_passed',
      path,
      status: response.status,
      ...(path === '/api/health' && data.commit ? { commit: data.commit } : {}),
      ...(path === '/api/auth/options' ? { integrations: data } : {}),
    }),
  );
}
