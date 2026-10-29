# Fotos de productos con Cloudinary

## Activación en Render

Creá una cuenta de Cloudinary y, en su consola, obtené el Cloud Name, API Key y API Secret de tu entorno de productos. Guardá estas tres variables en **Render → Impresion_3D → Environment**:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Cargá los valores directamente en Render. No los compartas por chat ni los agregues al repositorio. No uses prefijos `VITE_`: las credenciales deben existir sólo en el servidor. No necesitás configurar un preset de subidas sin firma: el backend firma la subida usando el SDK oficial.

Guardá las variables con despliegue. Mientras falten las tres, la aplicación sigue funcionando y la carga responde que todavía no está habilitada. Si sólo configurás algunas, el servidor rechaza la configuración incompleta; completá las tres en el mismo cambio.

## Uso

Ingresá como administrador → Administración → Productos. Primero guardá el producto. En su tarjeta, elegí una foto, revisá la vista previa y pulsá **Subir foto**. Si ya tiene una, el botón dice **Reemplazar foto**.

La foto se muestra en el catálogo después de guardarse. Si el producto no tiene foto, conserva la ilustración conceptual. Editar el nombre, precio o medidas no elimina la imagen.

## Tratamiento de archivos

Se permite una foto JPG, PNG o WebP de hasta 5 MiB y 20 megapíxeles. El servidor decodifica el contenido real: cambiar la extensión o el MIME de otro archivo no lo convierte en una foto válida. Se rechazan SVG y animaciones. La imagen se orienta, se reduce a un máximo de 1600 × 1600 conservando proporciones y se convierte a WebP sin los metadatos originales.

El navegador envía multipart al backend con cookie y token CSRF. Sólo usuarios cuyo rol actual en MongoDB sea `admin` pueden entrar a la ruta, antes de procesar el archivo. Se permiten hasta diez solicitudes de carga por minuto y cliente. Estas fotos son las del catálogo cargadas por el administrador: no habilita subidas de clientes ni la futura generación 3D.

Los archivos quedan en Cloudinary bajo `impresion3d/products/`, con identificadores aleatorios. MongoDB conserva URL, identificador y dimensiones. No se guardan archivos en el disco efímero de Render. La política CSP permite mostrar imágenes de `res.cloudinary.com`.

Al reemplazar una foto, primero se guarda la nueva referencia en MongoDB y después se intenta eliminar el recurso anterior. Si falla la limpieza, la foto nueva sigue funcionando y se puede limpiar la anterior desde Cloudinary. Si una escritura de MongoDB tiene un resultado ambiguo, se conserva el archivo nuevo para no borrar una foto que podría haberse guardado; excepcionalmente puede quedar un recurso sin referencia.

## Pruebas

`npm test` incluye permisos, CSRF, archivos falsos, formatos, tamaño, conversión, persistencia, reemplazo y fallas del almacenamiento externo. MongoDB y el procesamiento de imágenes son reales. Sólo la frontera con Cloudinary se reemplaza por un adaptador de prueba, para no necesitar credenciales ni subir archivos a tu cuenta en cada test.

La primera subida real a tu cuenta debe comprobarse después de configurar las tres variables. Revisá los límites y consumo de tu plan de Cloudinary.
