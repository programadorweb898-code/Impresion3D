# Catálogo de MakerWorld — 17 de noviembre de 2026

Se incorporan 30 diseños distintos del catálogo anterior de 18 publicaciones.
Todos tienen licencia Creative Commons CC0 (dominio público), comprobada en
la ficha de cada modelo en MakerWorld el 17/11/2026. Las fuentes, autores,
imágenes de referencia y enlaces de licencia están en
`makerworld-sources-20261117.json`. La ficha pública conserva el crédito y
enlaza al diseño y su licencia.

Cada producto arranca con un precio de **ARS 10.000**, almacenado como
1.000.000 de centavos, y dos imágenes WebP locales de 1000 × 1000:
una vista principal sobre blanco y otra ambientada en uso. Los archivos se
encuentran en `apps/web/public/product-catalog/`. Se generaron con la herramienta
integrada de imágenes, usando las fotos del diseño como referencia, conservando
forma, color, textura y proporciones. Son imágenes ilustrativas, indicadas como
tales en la ficha; no se presentan como fotografías de piezas ya fabricadas.
Los textos especifican el alcance del producto y los accesorios no incluidos.
No se inventan dimensiones: las que no fueron confirmadas muestran «A confirmar».

Las rutas `/description/ID` y `/descripcion/ID` usan el carrusel existente:
principal y «En uso». Los precios se pueden editar desde Administración sin
completar medidas pendientes. Si se ingresan medidas, se validan como positivas.

## Importación

`migrateMakerworldCatalog()` se ejecuta al iniciar el servidor después de conectar
MongoDB. Usa identificadores deterministas y `$setOnInsert`; comprueba nombres
y fuentes ya existentes antes de insertar. `catalogimports` registra la finalización
del lote. Un reinicio posterior no cambia precios, fotos o descripciones ni vuelve
a crear productos que un administrador haya eliminado. Una ejecución interrumpida
puede reintentarse sin duplicar lo que ya fue insertado.

## Retiro del visor

Se eliminan el botón del catálogo, la ventana del visor, el cargador administrativo
de modelos de productos, su endpoint y los módulos de visualización ya sin uso.
La API pública deja de devolver URLs y formatos de los antiguos modelos.
Los archivos históricos almacenados en Cloudinary no se borran. Los procesos
internos de cotización y fabricación que usan geometría conservan su función.

## Validación

Las pruebas de importación verifican 30 IDs y nombres distintos, las 60 imágenes,
el precio inicial, la preservación de ediciones y originales, el registro de lote
y la recuperación de una importación parcial. Las pruebas del catálogo verifican
que no se ofrezca carga ni descarga de modelos 3D de productos.
