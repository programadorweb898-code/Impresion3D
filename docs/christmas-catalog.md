# Diez productos navideños adicionales — 17/11/2026

Se suman diez diseños de MakerWorld a los 48 productos que ya estaban publicados.
Todos pertenecen a Navidad y comienzan con precio de **ARS 10.000** (1.000.000 de
centavos). No se modifica el precio de productos anteriores.

Las fuentes y licencias CC0 verificadas individualmente están en
`christmas-sources-20261117.json`. Cada ficha conserva el autor y enlaza al diseño
original y a su licencia. Se incluyen inicial con alce, estrella articulada,
farol navideño, adorno de paisaje, dado de intercambio de regalos, mini gorro,
bombilla decorativa colgante, posavasos copo de nieve, arbolito glaseado y árbol
acanalado para LED.

Cada uno tiene dos imágenes WebP locales de 1000 × 1000: principal sobre blanco
y escena de uso. Se generaron con la herramienta integrada de imágenes a partir
de las referencias originales, conservando geometría y colores. Se identifican
como imágenes ilustrativas en la ficha y los accesorios de ambientación no se
incluyen. Los archivos se guardan en `apps/web/public/product-catalog/`; las
instrucciones se registran en `christmas-image-prompts.json`.

`migrateChristmasCatalog()` ejecuta un lote independiente, registrado como
`makerworld-christmas-20261117` en `catalogimports`. Los IDs deterministas y las
inserciones condicionadas permiten reintentar una carga interrumpida. Al
finalizar el lote, los reinicios no cambian precios o fotos editados ni vuelven
a crear productos eliminados. Los modelos ya presentes se comprueban por
nombre normalizado y fuente antes de insertar.

No se agregan controles 3D. Las fichas siguen usando el carrusel de principal
y «En uso» en `/description/ID` y `/descripcion/ID`. Las medidas pendientes
siguen indicando «A confirmar».
