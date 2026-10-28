# Impresión3D

Tienda personal de productos impresos en 3D. Catálogo, registro, inicio/cierre de sesión, solicitudes de pedidos, historial privado y administración de productos y seguimiento. No procesa pagos online.

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

- GET `/api/health`, `/api/products`, `/api/csrf`
- POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- GET `/api/auth/me`, `/api/orders`
- POST `/api/orders`: productId, quantity, notes. Requiere sesión.

## Producción y trabajo pendiente

Serví el frontend compilado y `/api` bajo el mismo origen HTTPS mediante un proxy inverso; configurá WEB_ORIGIN con ese origen y NODE_ENV=production. TRUST_PROXY=1 solamente si existe exactamente un proxy confiable delante de Express. Persistí MongoDB y configurá sus copias de seguridad. No hay despliegue automático configurado.

El panel Administración permite crear y editar productos, ocultarlos del catálogo, consultar pedidos paginados, avanzar estados y establecer o quitar una fecha estimada de entrega. Los pedidos cerrados no se reabren. Los cambios concurrentes se rechazan para evitar pisar trabajo de otra pestaña. El rol se comprueba en MongoDB en cada solicitud administrativa; no se acepta desde el registro.

Para habilitar tu cuenta: registrala primero y ejecutá desde una terminal con acceso autorizado a tu base:

```sh
npm run admin:promote -w @impresion3d/api -- tu-correo@example.com
```

Volvé a iniciar sesión para ver Administración. No existe una contraseña administrativa predeterminada ni un endpoint público para otorgar permisos. Los productos se ocultan en lugar de eliminarse; los pedidos conservan su copia histórica.

Falta carga de fotos reales, recuperación de contraseña, verificación de correo y revisión operativa antes de abrir al público. No se inventan plazos ni cuenta regresiva.

Próximas etapas: fotos de productos y mejoras operativas; visor y modelos paramétricos propios con límites por producto; estimación mediante slicer y cola de fabricación; por último generación desde imágenes (por ejemplo Meshy), moderación y revisión de imprimibilidad. Esta versión no acepta archivos ni genera modelos 3D.

## Pruebas con MongoDB real y aislado

`npm test` incluye pruebas de integración con `mongodb-memory-server`. A pesar de su nombre, arranca un binario real de MongoDB temporal; no reemplaza las consultas por mocks. Descarga el binario en la primera ejecución y requiere red y permisos para abrir puertos locales. Los datos de prueba desaparecen al terminar. No utiliza MONGODB_URI ni tu base de producción.

Se verifican registro, hash Argon2id, login, regeneración y revocación de sesiones persistidas en MongoDB, aislamiento de pedidos, precios calculados en servidor, copia histórica, permisos administrativos, ocultación de productos, estados y conflictos de edición. Estas pruebas no sustituyen comprobar tu conexión y despliegue de Atlas.

`npm run format` aplica formato al código; `npm run format:check` lo verifica.
