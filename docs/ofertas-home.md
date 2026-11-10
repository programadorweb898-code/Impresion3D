# Ofertas del Home

El carrusel se inserta entre el hero y `#catalogo` (“La colección”). Los textos y precios se editan en `apps/web/src/OffersCarousel.jsx`.

- Bandeja navideña + cuatro adornos a elección: $35.000.
- Bolas navideñas con efecto tejido: de 1 a 5 a $3.000 cada una; desde 6 a $2.500 cada una.
- Llaveros: uno por $3.000; desde cinco, $2.000 por unidad.

Cada botón abre la página `/descripction/oferta/id` para elegir las opciones y agregarlas al carrito. Las reglas del carrito, disponibilidad e idempotencia se explican en [Selección y compra de ofertas](ofertas-carrito.md).

El avance automático cada seis segundos usa un índice circular y un fundido de 1,5 segundos entre las tres ofertas, sin retroceso visual al reiniciar el ciclo. Hay flechas, indicadores, teclado, gestos horizontales en celular y pausa/reproducción. El avance se pausa por pausa explícita, foco visible de teclado, pestaña oculta o carrusel fuera de vista. El puntero sobre el carrusel no lo detiene. La preferencia de movimiento reducido elimina las transiciones y conserva el avance automático solicitado. Las ofertas inactivas son `inert` y quedan excluidas del árbol accesible.

## Recursos visuales

Generados con la herramienta integrada de imágenes, usando fotos de los productos publicados del propietario como referencias. Son composiciones publicitarias; las superficies se describen como plástico impreso en 3D con efecto tejido. Los precios y mensajes se muestran como texto HTML accesible y no están incrustados en los archivos.

Archivos optimizados WebP, en variantes de 640 y 1200 píxeles de ancho:

- `apps/web/public/images/offers/navidad-combo-{640,1200}.webp`
- `apps/web/public/images/offers/navidad-bolas-colores-{640,1200}.webp`
- `apps/web/public/images/offers/llaveros-{640,1200}.webp`

El conjunto de las seis variantes ocupa aproximadamente 290 KiB. Se sirve `srcset` y carga diferida, sin recortar las piezas (`object-fit: contain`).

Especificaciones de los prompts empleados:

1. **Composición del combo:** fotografía publicitaria horizontal 3:2 con la bandeja dorada acanalada de referencia y exactamente cuatro figuras de las referencias: Papá Noel rojo, reno beige, árbol verde con estrella amarilla y muñeco de jengibre dorado. Mantener siluetas, colores, rostros y textura de impresión 3D de los productos; agrupar todas las figuras sobre la bandeja con rostros visibles. Mesa marfil, luces navideñas desenfocadas y rama discreta; luz suave y sombras naturales. Sin textos, precios, marcas añadidas ni figuras extra.
2. **Bolas navideñas:** fotografía horizontal 3:2 con exactamente seis copias de la bola blanca de referencia, conservando relieve de tejido, tapa y aro. Disposición en grupo sobre mesa marfil, cinco detrás y una delante, iluminación cálida, luces desenfocadas y rama al borde. Plástico PLA blanco, no tela. Sin recortes, texto ni productos diferentes.
3. **Llaveros:** fotografía horizontal 3:2 con cinco llaveros: tres placas negras de Malvinas y dos llaveros redondos de River, usando las dos referencias. Mantener formas, relieves, textos y emblemas originales, aros y cadenas de metal. Disposición diagonal en mesa marfil con luz de estudio y sombras suaves. Sin diseños inventados, precios ni texto promocional añadido.
