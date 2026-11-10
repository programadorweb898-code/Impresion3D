# Verificación para la etapa actual del proyecto

Arquitectura mantenida: una instancia Node/Express en Render, MongoDB y Cloudinary. No se agregaron servicios, colas nuevas ni dependencias.

## Correcciones

- Dos índices de catálogo para productos activos ordenados por precio o fecha; índice de pedidos por producto para la relevancia; desempate por identificador en el historial por cliente.
- El arranque espera los índices de Product y Order, además de los modelos que ya esperaba. El evento `database_indexes_ready` confirma que terminó la inicialización contra la base real. No se borran índices existentes.
- La relevancia incluye pedidos en preparación/finalizados y conserva compatibilidad con el histórico aprobado; excluye cancelados y pendientes sin aprobación.
- Las respuestas públicas de productos usan una lista explícita de campos. Los identificadores de almacenamiento y futuros campos internos quedan fuera.
- Hasta dos subidas de diseños activas y una por cliente en esta instancia. La admisión sucede antes de cargar el multipart en memoria; un exceso recibe una respuesta temporal clara, sin encolar archivos en RAM. Esto también serializa la comprobación del cupo de solicitudes abiertas por cliente.
- Los rate limits de rutas específicas devuelven JSON en español. El cliente conserva la referencia de diagnóstico fuera del texto visible; ante HTML del proxy muestra un mensaje genérico, sin HTML ni códigos HTTP.

## Verificaciones

- Pruebas de CSRF, origen, cookies seguras, roles, aislamiento de cuentas, archivos privados, contraseñas, recuperación, idempotencia y edición versionada ya existentes, ejecutadas junto con los cambios.
- Pruebas de consultas con `explain`: el listado ordenado por precio usa índice y examina 20 documentos para devolver 20; el cruce de relevancia usa el índice de producto en pedidos.
- Prueba controlada: catálogo sintético de 200 productos, 50 consultas en cinco grupos de diez concurrentes, mezclando relevancia y precio. Se verifica cada respuesta y se imprime su p95. Ese tiempo pertenece al entorno de pruebas y no es una garantía de capacidad de Render Free.
- Dos subidas simultáneas de un usuario con 19 solicitudes abiertas no superan 20.
- Prueba HTTP de admisión de subidas y liberación de capacidad; prueba del límite global; errores de proxy/servidor/límite comprobados también en navegador.
- Comprobación de archivos ocultos: no se publican configuración ni código del backend.

## Límites deliberados

- La búsqueda por prefijo continúa con expresiones regulares escapadas, con entradas acotadas. No se instala un motor de búsqueda para un catálogo pequeño. Estos filtros no aprovechan un índice de texto por usar coincidencia sin distinguir mayúsculas.
- La relevancia sigue siendo una agregación indexada, sin contadores precalculados ni invalidaciones adicionales. Revisar sus métricas si crecen mucho el catálogo o los pedidos.
- Rate limits y admisión de subidas son por proceso, adecuados para la instancia actual. Antes de multiplicar instancias hay que compartir el límite y hacer atómico el cupo entre procesos; cambiar a un plan pago de una sola instancia no exige Redis.
- Render Free puede suspenderse por inactividad y tiene recursos limitados. Pasar pruebas no demuestra capacidad ilimitada ni elimina esa demora.
- Atlas no permite actualmente acceso MCP para esta organización. La verificación directa del plan de consultas se realiza sobre una base aislada de pruebas; la creación de índices de producción se comprueba mediante el arranque del servicio, no mediante una consulta independiente a Atlas.
- No se realizan pedidos, registros o subidas ficticias en producción. Los flujos que escriben datos se prueban con base aislada; en producción se comprueban el despliegue, arranque, catálogo y navegación.
