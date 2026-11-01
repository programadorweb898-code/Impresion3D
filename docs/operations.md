# Operación y preparación para el público

El servicio confirmado de este proyecto es `https://impresion-3d.onrender.com`. En Render se llama `Impresion_3D`. El 1 de noviembre de 2026 se comprobó que el merge del PR #1 estaba `live`, con `/api/ready` respondiendo 200. El despliegue automático del servicio real está habilitado; el Blueprint del repositorio usa otro nombre y lo deja deshabilitado para instalaciones nuevas. No apliques ese Blueprint para crear otro servicio si querés mantener el existente.

Existe un segundo servicio `Impresion3D` (`https://impresion3d.onrender.com`) que falla al arrancar por una `MONGODB_URI` de formato inválido. Primero determiná si ese servicio todavía es necesario; si lo es, corregí su propia configuración autorizada. No copies secretos entre servicios por su nombre.

## Correos y acceso social

Configurá en Environment del servicio activo, sin colocar secretos en el repositorio:

- `RESEND_API_KEY` y `EMAIL_FROM`: remitente autorizado por Resend. Un dominio verificado puede ser distinto del dominio del sitio. Hasta tenerlo, las funciones de correo quedan deshabilitadas.
- `REQUIRE_EMAIL_VERIFICATION=1`: exige verificación en nuevos registros incluso si falta el transporte; en ese caso el registro devuelve 503. Con correo configurado la verificación se activa automáticamente, salvo que se deshabilite explícitamente con `0`. Las cuentas anteriores mantienen acceso.
- `ORDER_NOTIFICATION_EMAIL`: destinatario de los avisos del taller, modificable sin tocar código. Sin las credenciales de correo, el servidor continúa funcionando y muestra los avisos como deshabilitados.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`: seguí las URI de retorno de [acceso a cuentas](account-access.md). Los botones deshabilitados indican configuración ausente, no una prueba fallida de OAuth.

Los avisos quedan pendientes en cada pedido nuevo. Un worker interno los reclama por 60 segundos, usa una clave idempotente por pedido y reintenta hasta cinco veces con espera creciente. Un fallo no revierte el pedido. Los pedidos históricos sin esos campos no se notifican retroactivamente. Mientras el servicio gratuito esté dormido, el procesamiento espera a que vuelva a estar activo. No hay garantía de entrega inmediata ni verificación de llegada a la bandeja: Resend puede aceptar el envío sin que el destinatario lo reciba.

Probá el registro y la recuperación con una dirección propia, y verificá que el correo llegue. Probá Google/Facebook con sus usuarios de prueba antes de habilitar acceso público. Una configuración presente no demuestra permisos del proveedor, aprobación de la app ni entrega de correo. Evitá pruebas que envíen mensajes a clientes reales.

## Monitoreo

Administración → Estado del servicio muestra las integraciones habilitadas, el commit publicado y el número de avisos que agotaron los reintentos. Ese endpoint requiere rol administrativo; no devuelve credenciales.

Las respuestas de la API incluyen `x-request-id`. Los logs de errores son JSON con `event`, identificador y estado HTTP, sin cuerpos, contraseñas, enlaces de recuperación ni tokens. En los logs de Render buscá `http_request_failed`, `application_error`, `verification_email_delivery_failed`, `order_notification_failed` y `order_notification_worker_failed`. El panel cuenta fallos, pero no envía alertas de incidentes a un servicio externo por sí mismo.

Ejecutá una comprobación de lectura después de cada despliegue:

```sh
APP_ORIGIN=https://impresion-3d.onrender.com npm run check:production
```

No crea cuentas, pedidos ni correos. Para alertas continuas, conectá un monitor al endpoint `/api/ready` y un destino de alertas propio. El plan gratuito puede suspenderse; decidí el plan antes de fijar objetivos de disponibilidad. No se configuró un servicio de monitoreo externo ni un plan de pago automáticamente.

## Copias de seguridad de MongoDB

La disponibilidad, frecuencia y retención de snapshots dependen del plan del cluster. Entrá al proyecto correcto de Atlas, identificá el cluster utilizado por este servicio y revisá Backup. Definí una política de retención y verificá que existan snapshots recientes; no alcanza con que aparezca una opción habilitada. Si tu plan no ofrece la protección necesaria, evaluá un plan compatible o copias cifradas fuera del servicio de Render.

Una copia externa debe usar un usuario con permisos de backup, almacenar el resultado cifrado fuera del repositorio y del disco efímero de Render, y tener una política de retención y acceso. Probá la restauración en una base aislada y verificá usuarios, productos y pedidos antes de considerarla operativa. No uses `mongorestore --drop` sobre producción para probarla.

La revisión del 1 de noviembre de 2026 no pudo autenticar la conexión de Atlas. No se confirmó el plan, no se activaron snapshots y no se copió información de producción. La configuración de backups queda pendiente de acceso autorizado al proyecto; no fue sustituida por las bases temporales de tests.

## Rendimiento en celulares

Administración y el visor se descargan al abrirse. El visor renderiza al interactuar, conserva un límite de resolución de 1,5× en dispositivos táctiles y libera sus recursos al cerrarse. La suite de Chromium emula pantalla táctil con DPR 2 y comprueba que no se descarguen modelos al recorrer el catálogo. Estos controles no sustituyen medir una pieza real grande en el teléfono que vas a utilizar.
