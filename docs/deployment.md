# Publicar en Render con MongoDB Atlas

El repositorio contiene `render.yaml`: un servicio web gratuito que compila React y lo sirve con Express desde el mismo origen. MongoDB se aloja por separado en Atlas. La publicación no carga productos de ejemplo ni otorga roles administrativos automáticamente.

## 1. MongoDB Atlas

Usá una base llamada `impresion3d` dentro del cluster que elijas. Si ya existe un cluster, no hace falta crear otro.

En Atlas, creá un usuario de base exclusivo para esta aplicación, con permiso `readWrite` limitado a `impresion3d`. Este usuario es distinto de tu cuenta del panel de Atlas. Desde Connect → Drivers obtené la URI para Node.js; debe indicar la base `/impresion3d` y credenciales válidas, codificando caracteres especiales de la contraseña cuando corresponda.

Guardá esa URI directamente como `MONGODB_URI` en el panel de Render. No la pegues en issues, commits ni capturas públicas.

En Network Access permití las IP/rangos de salida que Render muestre para el servicio. La lista de Atlas permite clientes que pueden conectarse al cluster; es distinta de la lista de acceso de su API administrativa. Si necesitás autorizar tu computadora para administrar la aplicación, agregá también su IP. No es necesario abrir el acceso a todo Internet.

## 2. Render

Después de confirmar el workspace de destino, abrí:

https://dashboard.render.com/blueprint/new?repo=https://github.com/programadorweb898-code/Impresion3D

Seleccioná el workspace correcto, autorizá el repositorio si Render lo solicita y revisá el servicio `impresion3d-web`. El Blueprint usa el plan `free` y pide `MONGODB_URI`; Render genera `SESSION_SECRET`. No crees una base PostgreSQL: esta aplicación usa MongoDB.

El Blueprint no fija región: elegí una cercana al cluster de Atlas. Antes de aplicar, revisá que no exista otro servicio con el mismo nombre que no quieras incorporar al Blueprint.

La instalación incluye dependencias de desarrollo para compilar Vite. No ejecuta tests ni descarga un servidor temporal de MongoDB durante el build: las pruebas se ejecutan aparte.

La app usa `RENDER_EXTERNAL_URL` como origen cuando no definís `WEB_ORIGIN`. Si configurás un dominio propio, definí `WEB_ORIGIN` con su origen HTTPS exacto (sin rutas) y usá esa dirección para ingresar. Cookies Secure, HttpOnly y SameSite=Lax; CSRF valida ese origen y el token de sesión. `TRUST_PROXY=1` asume el proxy de Render delante de Express.

Los despliegues automáticos quedan desactivados. Los cambios posteriores requieren un deploy manual para entrar en producción.

## 3. Verificación

Esperá que el deploy figure `live`; que el build termine no basta.

- Abrí `/api/ready`: debe responder 200 con `{"status":"ready"}`. Responde 503 si Mongoose pierde la conexión. Es una comprobación del estado de la conexión, no un ping de MongoDB en cada petición.
- Abrí el sitio y verificá catálogo, registro, ingreso y cierre de sesión.
- Confirmá que en MongoDB se creen las colecciones de usuarios y sesiones dentro de `impresion3d`.
- Habilitá tu cuenta administrativa y creá un producto real. Verificá solicitud de pedido, historial privado y actualización de seguimiento.

## 4. Habilitar tu cuenta administrativa

Registrá tu cuenta desde el sitio. Desde una computadora autorizada en Atlas, configurá `apps/api/.env` con la URI de esa misma base y ejecutá:

```sh
npm run admin:promote -w @impresion3d/api -- tu-correo@example.com
```

Volvé a ingresar al sitio para ver Administración. El plan gratuito de Render no incluye shell remoto; este comando se puede ejecutar localmente sin cambiar de plan. No hay contraseña administrativa predeterminada.

## Límites de esta primera publicación

El servicio gratuito se suspende después de 15 minutos sin actividad y puede tardar aproximadamente un minuto en reactivarse. Las sesiones y los pedidos permanecen en Atlas. Para una tienda con tráfico real y respuesta constante, evaluá un plan sin suspensión.

Para habilitar fotos reales, seguí [la configuración de Cloudinary](product-photos.md). Todavía faltan verificación de correo y recuperación de contraseña. Los plazos se confirman manualmente; no hay generación de modelos ni pagos online. Configurá las copias de seguridad que correspondan a tu plan de Atlas antes de guardar pedidos reales.
