# Selección y compra de ofertas

Las tarjetas del Home abren `/descripction/oferta/navidad-combo`, `/descripction/oferta/navidad-bolas` y `/descripction/oferta/llaveros`. Las páginas muestran su imagen, descripción, opciones con casillas inicialmente vacías y botones para agregar al carrito o continuar comprando.

- **Bandeja + 4 adornos:** conserva el precio de $35.000. Incluye la bandeja y exige exactamente cuatro adornos diferentes; al marcar cuatro se deshabilitan los restantes. Las opciones se obtienen de productos activos cuya descripción indique efecto tejido, excluyendo bolas, bandejas y llaveros. Sin bandeja disponible o con menos de cuatro opciones, la oferta queda no disponible.
- **Bolas:** una por $3.000 o pack exacto de seis por $15.000. Blanco, rojo, verde, marrón, dorado metalizado y plateado metalizado. Las cantidades por color permiten repetir colores hasta completar el formato elegido. Se comprueba que el modelo base siga activo.
- **Llaveros:** diseños activos del catálogo, cantidades por diseño y precio de $3.000 por unidad o $2.000 desde cinco. Hasta 20 unidades por selección, conforme al límite actual del carrito.

Cada tipo de oferta ocupa una línea con su configuración completa. Editar o agregar nuevamente ese tipo actualiza su selección. No se modifica la cantidad de esa línea como si fueran piezas individuales: se vuelve a su página para editar sus componentes. Las líneas de oferta pueden combinarse con productos normales.

## Validación y persistencia

Las definiciones, precios y reglas están en `packages/shared/offers.js`. Los identificadores de línea son virtuales y reservados, sin crear productos duplicados en la base. `/api/offers/:id` devuelve opciones disponibles; `/api/offers/cart/preview` verifica el carrito autenticado para mostrar precios actualizados. El envío final vuelve a validar cantidades, opciones activas y precios en el servidor. No acepta importes enviados por el navegador como fuente de verdad.

El pedido conserva nombres y cantidades de las piezas/colores elegidos. La selección forma parte de la firma de idempotencia; cambiarla genera un intento de envío diferente y reutilizar la misma clave con otra selección se rechaza. Un reintento de un pedido ya guardado conserva su resultado histórico. La estructura anterior de carritos y pedidos normales permanece compatible.

El carrito conserva las selecciones por cuenta, incluso tras recargar. Un visitante puede elegir y luego iniciar sesión; el borrador se conserva al navegar al formulario de acceso dentro de la página. El botón Agregar continúa requiriendo sesión, como el resto del catálogo.

## Carrusel e imágenes

La rotación automática circular sigue cada seis segundos y ya no se detiene por mantener el puntero sobre una tarjeta. La pausa explícita, el foco visible de teclado, la pestaña oculta y quedar fuera de vista sí la pausan. La preferencia de movimiento reducido elimina la transición, manteniendo la rotación solicitada y la opción de pausa.

Las imágenes de bolas se editaron con la herramienta integrada usando como referencia el mismo modelo de bola tejida: cambiar solo colores a blanco, rojo, verde, marrón, dorado y plateado, conservando geometría, textura de tejido, tapa, aro, disposición e iluminación, sin texto ni otros adornos. La imagen de opciones usa el mismo modelo en una cuadrícula 3×2: blanco/rojo/verde arriba, marrón/dorado/plateado abajo, cada bola centrada en una celda con fondo neutro. Se generan WebP optimizados, y la cuadrícula se presenta por celdas con CSS.

- `apps/web/public/images/offers/navidad-bolas-colores-{640,1200}.webp`
- `apps/web/public/images/offers/bolas-colores-opciones.webp`

El formato de precios y las combinaciones del Home se mantienen alineados con estas reglas. Las ofertas ya no enlazan a WhatsApp.
