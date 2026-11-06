# Galería de productos

Las fichas `/descripcion/ID` y `/description/ID` muestran dos imágenes:
la foto principal del catálogo y una ambientación de uso. Se eliminó la
variante girada 45°, tanto del carrusel como de sus estilos y miniaturas.
Administración permite cargar solamente la foto adicional «En uso».

Se prepararon 15 ambientaciones con la herramienta integrada de generación de
imágenes, tomando como referencia visual cada foto original del catálogo del
5 de noviembre de 2026. El 6 de noviembre se ampliaron los encuadres de las
15 escenas, usando cada ambientación anterior como referencia de edición.
Se revisaron forma, colores, detalles y contexto de uso.
Son ilustraciones de ambientación, no fotografías de clientes.

Los WebP están en `apps/web/public/product-scenes/`, con el ID de cada producto
y el sufijo `-wide`, para evitar que el navegador conserve la versión anterior.
`apps/web/src/product-scenes.json` vincula cada escena a su foto de origen.
Si se reemplaza esa foto en Administración, la ambientación anterior deja de
mostrarse automáticamente. Una foto cargada en `gallery.context` tiene prioridad.
No se modifican documentos de MongoDB ni credenciales de Cloudinary.

Instrucción común de generación: conservar forma, proporciones, colores,
materiales, textura de capas y detalles del producto; alejar la cámara y ampliar
el ambiente de uso realista, con el producto entero, nítido y protagonista,
ocupando aproximadamente el 40–45 % de la altura del encuadre. La bandeja, por
su formato horizontal, ocupa aproximadamente el 50–55 % del ancho. Mostrar
más habitación y superficie, con escala coherente y sombras de contacto,
sin bordes, relleno blanco, marcas de agua ni nuevas inscripciones. Mantener
los logotipos y las palabras del producto sin alterarlos. Las bolas cuelgan del
árbol, el servilletero sostiene servilletas, el pesebre y las figuras decoran
una consola navideña, la bandeja lleva adornos, los llaveros llevan llaves,
el organizador sostiene platos y los cuencos muestran golosinas en Halloween.
