# Acceso y recuperación de cuentas

`/login` es una pantalla independiente, sin cabecera ni menú del sitio. Permite email y contraseña, Google y Facebook, con los logos correspondientes. Cada botón social se habilita únicamente cuando el backend tiene las dos credenciales de ese proveedor. No se simula un acceso exitoso cuando falta configuración. Se conserva un enlace discreto para volver al catálogo.

## Recuperación por correo

El enlace «¿Olvidaste tu contraseña?» solicita el email. La implementación preparada usa Resend. En Render, en el servicio de impresión3D, agregar:

- `RESEND_API_KEY`: clave de una cuenta Resend autorizada para enviar.
- `EMAIL_FROM`: remitente autorizado, por ejemplo `impresión3D <cuentas@tu-dominio.com>`.

Verificar el dominio y los registros DNS que indique Resend antes de usar el remitente en producción. El remitente de prueba de Resend no permite enviar a cualquier cliente. No colocar estas claves en variables `VITE_`, archivos versionados ni mensajes de chat. Guardarlas directamente en Environment de Render y aplicar el cambio para reiniciar el servicio.

El enlace apunta al origen fijo configurado por `WEB_ORIGIN` o `RENDER_EXTERNAL_URL`. Tiene 256 bits aleatorios, vence a los 30 minutos y puede usarse una vez. MongoDB guarda únicamente su hash. El navegador recibe el secreto en el fragmento `#reset=`, que no se envía como parte de la solicitud HTTP, y lo retira de la URL al abrir el formulario. Si se recarga esa pantalla luego de retirar el fragmento, hay que volver a abrir el enlace original del correo.

Los reenvíos se limitan a uno por minuto por cuenta, además del límite por IP. Se responde lo mismo para cuentas existentes, inexistentes, de acceso social o con fallo de entrega. No se imprime el enlace, la contraseña ni la respuesta del proveedor en los logs. Un cambio de contraseña incrementa la versión de autenticación para invalidar las sesiones existentes, incluidas las de otros dispositivos, y requiere iniciar sesión nuevamente. No convierte cuentas exclusivamente sociales en cuentas con contraseña.

Sin configuración de correo, la recuperación informa que el servicio no está disponible. El registro e ingreso por email siguen funcionando.

## Google

1. Crear o seleccionar un proyecto en Google Cloud Console y configurar Google Auth Platform: marca, público y contacto.
2. Crear un cliente OAuth de tipo **aplicación web**.
3. Configurar la URI de redirección autorizada exacta:
   `https://impresion-3d.onrender.com/api/auth/google/callback`
4. Agregar en Render `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` y reiniciar.
5. En modo de pruebas, agregar los usuarios de prueba. Para público general, publicar la configuración de consentimiento y cumplir los requisitos de Google.

Permisos solicitados: `openid email profile`. Se valida un email verificado. El intercambio del código y la consulta de identidad ocurren en el backend, con secreto de cliente, `state` ligado a la sesión y PKCE S256. El navegador nunca recibe secretos del cliente ni tokens de Google.

## Facebook

1. Crear una aplicación en Meta for Developers y configurar Facebook Login para web.
2. Registrar el sitio `https://impresion-3d.onrender.com` y habilitar OAuth web con la URI exacta:
   `https://impresion-3d.onrender.com/api/auth/facebook/callback`
3. Agregar en Render `FACEBOOK_CLIENT_ID` (App ID) y `FACEBOOK_CLIENT_SECRET` (App Secret).
4. La versión de Graph API predeterminada es `v23.0`. Puede configurarse con `FACEBOOK_GRAPH_VERSION` cuando corresponda actualizarla.
5. En modo desarrollo sólo ingresan los roles y probadores autorizados de la app. Para clientes reales, configurar las URLs públicas de política de privacidad y eliminación de datos, pasar los requisitos que solicite Meta y activar el modo público. No publicar textos legales con datos ficticios.

Permisos solicitados: `email,public_profile`. El correo es opcional para Facebook:
si falta, es inválido o el usuario no comparte ese permiso, una identidad válida
puede crear su cuenta e iniciar sesión. La identidad se obtiene exclusivamente del
perfil que devuelve Graph después del intercambio del código; no se acepta un ID
enviado por el navegador. Se conserva `appsecret_proof`, la sesión HttpOnly y el
`state` de un solo uso con vencimiento de diez minutos. Cancelar el acceso completo,
un código inválido o una respuesta sin ID siguen impidiendo el ingreso.

La cuenta queda sin el campo `email`, sin dirección inventada y sin marcar el
correo como verificado. Los siguientes accesos buscan `provider + subject` y
recuperan el mismo usuario y sus pedidos, incluso si Facebook cambia u omite el
correo. No se incorpora ni reemplaza automáticamente un email en accesos posteriores.
La creación concurrente de la misma identidad recupera la cuenta ganadora y elimina
únicamente la cuenta provisional del intento que perdió el índice único.

El perfil indica «Sin correo agregado». Con Resend disponible, permite agregar
una dirección mediante el flujo existente de confirmación por enlace. Hasta
confirmarla, no se puede crear una contraseña. Sin Resend, el ingreso por Facebook,
el catálogo, los pedidos y la edición del nombre siguen disponibles; el formulario
de correo explica la indisponibilidad. Los antiguos enlaces de error por email
permiten reintentar el acceso normal, sin exigir permisos adicionales.

### Índice de email para cuentas sociales

`users_email_unique` mantiene la unicidad sólo para documentos cuyo email es una
cadena. Antes de atender solicitudes, `server.js` construye ese índice y después
retira exclusivamente el índice legado `email_1` si coincide con su definición
conocida (único, email ascendente, sin filtro, sparse ni collation). La transición
es idempotente y conserva la protección de los emails durante todo el cambio; no
modifica usuarios ni otros índices. Usa índices con la misma clave y distintas
opciones, compatibles con MongoDB 5 o superior. Si la construcción o validación
falla, el servidor no comienza a escuchar. Una reversión a la versión anterior
requiere conservar este índice: no recrear el índice único sin filtro cuando ya
existan varias cuentas sin correo.

## Identidades y cuentas existentes

La colección `socialidentities` mantiene un índice único de proveedor e identificador. Los pedidos y roles siguen asociados a `users`. No hay vinculación automática por coincidencia de email: si ya existe otra cuenta con ese correo, hay que usar su método original. La vinculación explícita de múltiples métodos desde una cuenta autenticada queda fuera de esta entrega. Las cuentas sociales nuevas siempre tienen rol `customer`.

El acceso continúa usando las sesiones HttpOnly del sitio. Las mutaciones de recuperación conservan las comprobaciones de Origin y CSRF. Las credenciales opcionales nuevas no afectan el arranque de los despliegues existentes.

## Validación

Pruebas con MongoDB aislado real: tokens de recuperación, vencimiento, uso único, concurrencia, invalidación de sesiones, OAuth state/PKCE, Google con email no verificado, protección contra vinculación por email, Facebook y firma appsecret_proof. Las llamadas de OAuth y correo se sustituyen en estas pruebas para no usar cuentas reales ni enviar mensajes. La activación en producción debe comprobarse con las credenciales y cuentas de prueba propias de los proveedores.

## Mi perfil

`/perfil` muestra nombre y email, edición del nombre, cambio o creación de contraseña, solicitud de cambio de email y cierre de sesión. El enlace «Mi perfil» aparece a la derecha del menú para cuentas autenticadas. La cabecera y el footer se mantienen en catálogo, perfil, carrito, pedidos y administración; `/login` permanece independiente.

Las rutas `/api/profile` requieren sesión válida y las mutaciones mantienen CSRF y Origin. Sólo se admite modificar los campos explícitos: no se permite cambiar rol ni seleccionar otro usuario. Cambiar contraseña exige la actual, conserva la sesión que realiza el cambio y revoca las demás. Las cuentas sociales deben confirmar su identidad con su proveedor dentro de los últimos cinco minutos para crear una contraseña o solicitar un cambio de correo; la identidad debe coincidir con la cuenta ya autenticada.

El nuevo correo debe confirmarse usando un enlace enviado a esa dirección. Se usan las mismas variables `RESEND_API_KEY` y `EMAIL_FROM`; mientras falten, el sitio informa que el envío no está disponible y mantiene el email actual. El enlace vence en 30 minutos, se guarda sólo su hash, requiere iniciar sesión en la cuenta correcta y se consume una vez. El formulario de confirmación usa POST con CSRF. La dirección anterior no cambia al solicitar el enlace, y una dirección ocupada se rechaza. La confirmación mantiene el ID, los pedidos y el rol de la cuenta, cierra otras sesiones e invalida enlaces de recuperación anteriores. No cambia el email de la cuenta de Google o Facebook: sólo el correo usado en este sitio.

## Confirmación del registro

Con Resend configurado, los nuevos registros quedan pendientes: no abren sesión y el login devuelve `EMAIL_UNVERIFIED` hasta confirmar. El enlace `#verify=` vence a los 30 minutos, se guarda sólo su hash y se consume una vez mediante POST con CSRF. La pantalla retira el secreto de la URL y pide elegir la contraseña definitiva; esto evita que una preregistración conserve una contraseña ajena al dueño del correo. El usuario inicia sesión después de confirmar. Las cuentas existentes conservan su acceso.

«Reenviar confirmación» responde lo mismo para correos existentes e inexistentes, limita reenvíos por cuenta a uno por minuto y conserva los límites por IP. Un fallo de entrega mantiene la cuenta pendiente. Con `REQUIRE_EMAIL_VERIFICATION=1` y sin correo configurado, el registro informa indisponibilidad; con correo configurado la verificación se activa automáticamente salvo un `0` explícito. Google marca el email verificado sólo cuando el proveedor lo confirma; no se asume lo mismo para Facebook. La recuperación mediante un enlace válido también confirma la dirección que lo recibió.

## Datos que faltan para activar los botones sociales

El código ya intercambia los códigos OAuth en el backend. Para activar cada opción hay que crear sus credenciales y guardarlas en **Environment del servicio actual de Render**, sin prefijo `VITE_`:

| Proveedor | Variable                 | Valor                                       |
| --------- | ------------------------ | ------------------------------------------- |
| Google    | `GOOGLE_CLIENT_ID`       | ID del cliente OAuth de tipo aplicación web |
| Google    | `GOOGLE_CLIENT_SECRET`   | Secreto de ese mismo cliente                |
| Facebook  | `FACEBOOK_CLIENT_ID`     | App ID de Meta                              |
| Facebook  | `FACEBOOK_CLIENT_SECRET` | App Secret de esa misma aplicación          |

Registrar las URLs de retorno exactas en cada consola, sin barra final:

- Google: `https://impresion-3d.onrender.com/api/auth/google/callback`
- Facebook: `https://impresion-3d.onrender.com/api/auth/facebook/callback`

En Google configurar la pantalla de consentimiento y los usuarios de prueba; para el público general, pasar la configuración a producción y cumplir las verificaciones que pida Google. En Meta configurar Facebook Login web, el dominio/sitio, la política de privacidad y las instrucciones o mecanismo de eliminación de datos. Mientras la app esté en desarrollo, sólo pueden usarla sus roles y probadores; para clientes hay que cumplir los requisitos de Meta y activar el modo público. Estas páginas legales requieren datos reales del responsable del sitio.

Al guardar las variables y aplicar el despliegue, `/api/auth/options` informa qué proveedores quedaron habilitados sin exponer secretos. La verificación final del acceso necesita las credenciales y cuentas de prueba propias; las pruebas automatizadas sustituyen las respuestas de los proveedores y no prueban la aprobación pública de las aplicaciones.

## Confirmar identidad sin abandonar el perfil

El perfil consulta al servidor hasta cuándo está vigente la identidad confirmada.
Durante esos cinco minutos se oculta la opción de volver a confirmar. También se
oculta si no existe ninguna operación sensible disponible (sin correo y sin envío
de confirmaciones). Al vencer, Google/Facebook se abre mediante una ventana
emergente; el perfil permanece en la pestaña original. El navegador puede presentar
esa ventana como otra pestaña en dispositivos móviles.

Sólo una sesión autenticada que solicita reautenticación puede activar el modo
popup. La respuesta del callback vuelve al origen del sitio y usa un script externo
permitido por CSP para cerrar la ventana. Aceptar renueva la identidad; cancelar,
fallar el state o usar otra identidad no la renueva. El perfil vuelve a consultar el
estado real del servidor después del cierre y muestra el resultado. Cerrar la ventana
manualmente conserva la sesión y permite seguir navegando. No se confía en mensajes
ni datos de autenticación enviados por la ventana. Helmet usa
`same-origin-allow-popups` para conservar el control de las ventanas de OAuth.

Las pruebas automatizadas verifican aceptar, cancelar, cerrar con la cruz y rechazar
una identidad diferente. Las pantallas de consentimiento de los proveedores se
sustituyen sólo en el servidor y navegador aislados de pruebas.
