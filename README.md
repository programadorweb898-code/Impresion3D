# Impresión3D

Tienda personal de productos impresos en 3D. Catálogo, registro, inicio/cierre de sesión, carrito para usuarios registrados, pedidos con varios productos, historial privado y administración de productos y seguimiento. No procesa pagos online.

## Requisitos y ejecución

Node.js 24 y MongoDB local o Atlas. Desde la raíz:

```sh
npm install
cp apps/api/.env.example apps/api/.env
```

Configurá `MONGODB_URI` y generá un secreto propio con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Pegalo como `SESSION_SECRET`. No subas `.env` a GitHub.

```sh
npm run seed -w @impresion3d/api
npm run dev:api
# En otra terminal:
npm run dev:web
```

Abrí http://localhost:5173. Los productos, importes en ARS e ilustraciones son ejemplos: reemplazalos por productos reales antes de publicar. Las dimensiones están en milímetros y los importes se almacenan como centavos enteros.

```sh
npm test
npm run build
```

## Arquitectura

Workspaces npm: `apps/web` (React/Vite/Tailwind), `apps/api` (Express/Mongoose) y `packages/shared` (esquemas Zod compartidos). Se utiliza JavaScript con módulos ES en esta primera base.

MongoDB guarda usuarios, catálogo, pedidos y sesiones. Argon2id usa 19 MiB, 2 iteraciones y paralelismo 1. La cookie es HttpOnly, SameSite=Lax y Secure en producción. Las mutaciones requieren origen configurado y token CSRF, las sesiones se regeneran al autenticar y las rutas tienen límites de peticiones. Los precios se calculan en el servidor y cada pedido conserva una copia del producto y precio. El historial consulta exclusivamente los pedidos del usuario autenticado; índice compuesto por usuario y fecha.

## API

- GET `/api/health`, `/api/products?page=1&category=Hogar`, `/api/csrf`
- POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- GET `/api/auth/me`, `/api/orders?page=1`
- POST `/api/orders`: items (productId, quantity, expectedUnitPriceCents), notes y requestId. Requiere sesión. También admite el formato anterior de un producto.

Catálogo e historial usan páginas de 20 registros; las respuestas incluyen products/orders, page, pages y total. El catálogo incluye categorías y admite filtro category. El carrito consulta hasta 20 IDs con `/api/products?ids=id1,id2`. Sin page se conserva el formato de array anterior, limitado a 20 registros. Editar productos requiere version, obtenida de __v en Administración; una versión desactualizada devuelve 409.

## Producción y trabajo pendiente

La configuración de publicación está en `render.yaml`. Seguí [la guía de despliegue](docs/deployment.md) para conectar Atlas, configurar secretos y verificar el sitio. El repositorio preparado no implica que el servicio ya esté publicado.

En producción Express sirve el frontend compilado y `/api` bajo el mismo origen HTTPS. Ejecutá `npm run build` y luego `npm start`; configurá WEB_ORIGIN con ese origen y NODE_ENV=production, o usá el origen que Render proporciona automáticamente. TRUST_PROXY=1 solamente si existe exactamente un proxy confiable delante de Express. Persistí MongoDB y configurá sus copias de seguridad. El Blueprint deja los despliegues automáticos desactivados para instalaciones nuevas. El servicio existente `Impresion_3D` tiene auto-deploy habilitado: las opciones del Dashboard determinan su comportamiento actual.

El panel Administración permite crear y editar productos, ocultarlos del catálogo, consultar pedidos paginados, avanzar estados y establecer o quitar una fecha estimada de entrega. Los pedidos cerrados no se reabren. Los cambios concurrentes de pedidos y fichas de productos se rechazan para evitar pisar trabajo de otra pestaña. El rol se comprueba en MongoDB en cada solicitud administrativa; no se acepta desde el registro.

Para habilitar tu cuenta: registrala primero y ejecutá desde una terminal con acceso autorizado a tu base:

```sh
npm run admin:promote -w @impresion3d/api -- tu-correo@example.com
```

Volvé a iniciar sesión para ver Administración. No existe una contraseña administrativa predeterminada ni un endpoint público para otorgar permisos. Los productos se ocultan en lugar de eliminarse; los pedidos conservan su copia histórica.

Las fotos reales se cargan desde Administración con Cloudinary: seguí [la guía de fotos](docs/product-photos.md) para habilitar las tres variables del servidor. La recuperación de contraseña y el cambio confirmado de email usan Resend. El acceso con Google y Facebook se habilita con sus credenciales. Consultá [acceso y cuentas](docs/account-access.md). El registro confirma el correo cuando se configura Resend; los registros pendientes no abren sesión y el enlace permite elegir la contraseña definitiva. Consultá [operación y preparación para el público](docs/operations.md) para activar avisos, revisar integraciones y configurar backups. No se inventan plazos ni cuenta regresiva.

El [visor 3D del catálogo](docs/catalog-3d.md) permite asociar un GLB, STL o 3MF a cada producto desde Administración, sin usar Meshy. Requiere archivos reales; no convierte las fotos en modelos.

Próximas etapas: mejoras operativas; visor y modelos paramétricos propios con límites por producto; estimación mediante slicer y cola de fabricación; por último generación desde imágenes (por ejemplo Meshy), moderación y revisión de imprimibilidad. Esta versión permite a administradores cargar fotos y modelos GLB, STL y 3MF; no acepta archivos de clientes ni genera modelos con IA.

## Pruebas con MongoDB real y aislado

`npm test` incluye pruebas de integración con `mongodb-memory-server`. A pesar de su nombre, arranca un binario real de MongoDB temporal; no reemplaza las consultas por mocks. Descarga el binario en la primera ejecución y requiere red y permisos para abrir puertos locales. Los datos de prueba desaparecen al terminar. No utiliza MONGODB_URI ni tu base de producción.

Se verifican registro, hash Argon2id, login, regeneración y revocación de sesiones persistidas en MongoDB, aislamiento de pedidos, precios calculados en servidor, copia histórica, permisos administrativos, ocultación de productos, estados y conflictos de edición. Estas pruebas no sustituyen comprobar tu conexión y despliegue de Atlas.

`npm run format` aplica formato al código; `npm run format:check` lo verifica.

## Carrito

El [carrito de compras](docs/cart.md) requiere sesión antes de agregar productos, permite cambiar cantidades y enviar un único pedido con varias piezas. Los importes se calculan en Express y los artículos se conservan como copia histórica en MongoDB. No incorpora pagos online.

## Pruebas de navegador

`npm run test:e2e` verifica navegación móvil, catálogo paginado, centavos, sesión, carrito, reintentos tras recarga, historial y visor WebGL. Usa MongoDB temporal aislado y datos sintéticos; no utiliza producción. Instalá Chromium con `npx playwright install chromium` o definí `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con un navegador local.
