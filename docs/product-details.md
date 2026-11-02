# Ficha de producto y enlace para volver

Al tocar la imagen de una tarjeta se abre `/descripcion/ID`. Se conservan los datos y la URL de foto actuales del producto. Las variantes `/descripción/ID` y `/descripction/ID` también abren la ficha por compatibilidad.

La imagen ocupa `50vw`, limitada al ancho disponible de su contenedor, y se centra. Debajo aparecen la descripción completa almacenada en Administración, ancho, alto y profundidad en milímetros, precio y los botones Agregar al carrito y Continuar comprando. No se inventan especificaciones ni se reemplazan fotos. La ficha no cambia el grid del catálogo.

`GET /api/products/:id` es una consulta pública de una pieza activa. Devuelve 404 para productos ocultos, inexistentes o identificadores inválidos, y no cambia las consultas paginadas ni la consulta por IDs usada por el carrito.

El enlace Volver está arriba a la izquierda en todas las vistas, también en login sin agregarle navbar ni footer. Usa el historial interno del sitio; cuando se accede directamente a una página sin entrada anterior propia, vuelve al catálogo. Los cambios de vista de perfil, pedidos y administración se registran en el historial. Al abrir una ficha se conserva la categoría y la página del catálogo en el estado de navegación, de modo que volver después de recargar no pierda ese contexto. El estado no contiene credenciales ni datos de pago.

Para agregar desde la ficha sigue siendo necesario ingresar. Después del login se vuelve al producto que se estaba consultando y el agregado requiere la acción explícita del cliente. Si ya está en el carrito, el botón queda deshabilitado. Los comentarios y la persistencia del carrito se mantienen en el mecanismo existente.

Las pruebas de navegador cubren la imagen al 50% entre 320 y 1280 px, enlaces directos y con tilde, recarga, Atrás, filtros, login, productos ya agregados y el regreso desde las vistas de cuenta. El servidor de pruebas usa IPs sintéticas por caso en un host local para que las pruebas no agoten en conjunto el límite de un único cliente; el límite y la configuración de producción permanecen intactos.
