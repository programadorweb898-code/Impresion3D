# Visor 3D del catálogo

Cada producto puede tener una foto y un archivo 3D independiente. La foto es la portada. El botón **Ver en 3D** sólo aparece cuando el administrador carga un modelo válido.

No hay generación de IA en esta etapa. Ver, girar o acercar un modelo no llama a Meshy ni consume sus créditos. Tampoco hay carga de imágenes de clientes, edición de medidas ni cálculo de presupuestos desde la geometría.

## Cargar tus modelos

1. Entrá como administrador a **Administración → Productos**.
2. En la tarjeta del producto, buscá **Modelo 3D del producto**.
3. Seleccioná su archivo **GLB, STL o 3MF** y pulsá **Subir modelo 3D**.
4. Usá **Revisar modelo 3D** para comprobarlo y verificá el botón del catálogo.

Para reemplazarlo, elegí otro archivo en la misma tarjeta. Editar precio, descripción o foto no elimina el modelo. Primero debe existir el producto.

Si el modelo proviene de Meshy, exportá GLB y cargalo una sola vez. Si ya tenés el original STL, podés usarlo sin generar nada. La subida no convierte una foto en 3D. Los archivos 3MF se convierten automáticamente a GLB en el servidor; los OBJ deben exportarse previamente a GLB.

## Formatos y límites

- Hasta **10 MiB** por modelo; un solo archivo por carga.
- **GLB 2.0:** geometría y texturas incorporadas dentro del mismo archivo. No se aceptan URLs, recursos separados, Draco, Meshopt ni texturas KTX2. Hasta 300.000 triángulos, un millón de vértices y 10.000 nodos. La estructura y los buffers se comprueban con glTF Validator.
- **3MF:** se convierte a GLB conservando materiales base y grupos de color estándar, componentes, posiciones y unidades. En proyectos Bambu se admite la paleta `filament_colour` y asignaciones de extrusor por objeto o parte. Se rechazan texturas 3MF y pintado avanzado por subdivisiones (`paint_color`/`mmu_segmentation`) en lugar de mostrar colores incorrectos. Se limitan las entradas ZIP, la descompresión y la complejidad; no se incluyen ajustes de impresión ni G-code en el GLB publicado. El límite de 10 MiB también se aplica al resultado convertido.
- **STL binario o ASCII:** hasta 200.000 triángulos y coordenadas finitas, con extensión en los tres ejes. El ASCII se convierte a STL binario para el visor. No conserva colores ni texturas y se muestra con material neutro.

Los controles permiten girar, acercar, alejar, restablecer la cámara y mirar desde arriba. También se puede arrastrar o usar gestos táctiles. Las medidas que se muestran son las de la ficha del producto: el visor centra el modelo para mostrarlo, no mide ni valida sus dimensiones físicas, espesor, escala o imprimibilidad. No anima rigs ni escenas.

El visor se descarga al abrirlo, usa WebGL y libera geometrías, texturas y contexto al cerrarse. Si WebGL o la descarga fallan, muestra un mensaje y la foto del catálogo sigue disponible.

## Almacenamiento y permisos

Se reutilizan las tres variables de Cloudinary que ya tiene el backend. Los modelos se suben firmados como recursos **raw**, bajo `impresion3d/models/`. MongoDB conserva URL, identificador, formato y tamaño. La imagen del producto se conserva por separado. Cloudinary aplica además los límites y políticas de tu plan.

Sólo administradores autenticados y con CSRF pueden subir un modelo. Hay un límite de cinco solicitudes de carga por minuto y cliente. Los visitantes pueden ver el modelo publicado sin registrarse; no se descarga ningún modelo al limitarse a recorrer el catálogo.

Los modelos publicados son archivos públicos que llegan al navegador. El visor no impide que se descarguen: subí únicamente archivos que quieras compartir públicamente. El servidor rechaza GLB que dependan de otros servidores o archivos.

Al reemplazar, se guarda primero la nueva referencia y después se intenta limpiar el recurso anterior. Una falla de almacenamiento conserva el modelo previo; una escritura ambigua puede dejar un archivo sin referencia y requiere revisar el producto antes de repetir.

## Verificación

`npm test` cubre conversión 3MF a color (incluyendo paletas Bambu, transformaciones y rechazos de archivos inválidos), validación real de STL y GLB, permisos, CSRF, límites, reemplazo y conservación de la foto, con MongoDB temporal real. El transporte externo se simula en pruebas. La prueba del navegador usa geometría sintética sólo para verificar el funcionamiento; no se publica ni se presenta como un modelo de tus productos.

Antes de publicar una pieza con su vista 3D, cargá su archivo real y revisá que corresponda a la foto. No se han generado automáticamente modelos para las fotos del catálogo.
