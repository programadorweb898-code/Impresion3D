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

Permisos solicitados: `email,public_profile`. Si Facebook no comparte un email, se indica usar otra opción o revisar permisos. El backend intercambia el código, solicita el perfil y envía `appsecret_proof`. No guarda tokens del proveedor. El `state` depende de la sesión, vence a los 10 minutos y se consume al recibir el callback. Cancelaciones, códigos inválidos y errores regresan a `/login` con mensajes controlados.

## Identidades y cuentas existentes

La colección `socialidentities` mantiene un índice único de proveedor e identificador. Los pedidos y roles siguen asociados a `users`. No hay vinculación automática por coincidencia de email: si ya existe otra cuenta con ese correo, hay que usar su método original. La vinculación explícita de múltiples métodos desde una cuenta autenticada queda fuera de esta entrega. Las cuentas sociales nuevas siempre tienen rol `customer`.

El acceso continúa usando las sesiones HttpOnly del sitio. Las mutaciones de recuperación conservan las comprobaciones de Origin y CSRF. Las credenciales opcionales nuevas no afectan el arranque de los despliegues existentes.

## Validación

Pruebas con MongoDB aislado real: tokens de recuperación, vencimiento, uso único, concurrencia, invalidación de sesiones, OAuth state/PKCE, Google con email no verificado, protección contra vinculación por email, Facebook y firma appsecret_proof. Las llamadas de OAuth y correo se sustituyen en estas pruebas para no usar cuentas reales ni enviar mensajes. La activación en producción debe comprobarse con las credenciales y cuentas de prueba propias de los proveedores.
