# Galería de productos

Las fichas `/descripcion/ID` y `/description/ID` muestran la foto principal,
la misma foto completa girada 45° en sentido horario y una ambientación de uso.
El giro se hace con CSS, con margen para no cortar las esquinas, y reutiliza la
foto original sin descargar otra copia.

Se prepararon 15 ambientaciones con la herramienta integrada de generación de
imágenes, tomando como referencia visual cada foto original del catálogo del
5 de noviembre de 2026. Se revisaron forma, colores, detalles y contexto de uso.
Son ilustraciones de ambientación, no fotografías de clientes.

Los WebP están en `apps/web/public/product-scenes/`, con el ID de cada producto.
`apps/web/src/product-scenes.json` vincula cada escena a su foto de origen.
Si se reemplaza esa foto en Administración, la ambientación anterior deja de
mostrarse automáticamente. Una foto cargada en `gallery.context` tiene prioridad.
No se modifican documentos de MongoDB ni credenciales de Cloudinary.

Instrucción común de generación: conservar forma, proporciones, colores,
materiales, textura de capas y detalles del producto; reemplazar el fondo blanco
por un ambiente de uso realista, producto entero y protagonista, sombras de
contacto, sin marcas de agua ni nuevas inscripciones. Las bolas cuelgan del
árbol, el servilletero sostiene servilletas, el pesebre y las figuras decoran
una consola navideña, la bandeja lleva adornos, los llaveros llevan llaves,
el organizador sostiene platos y los cuencos muestran golosinas en Halloween.
