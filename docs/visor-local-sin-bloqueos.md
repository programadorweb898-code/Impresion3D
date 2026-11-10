# Lectura local de 3MF y STL sin bloquear la página

El visor procesa descompresión, XML, geometría, normales y medidas por pieza de 3MF/STL en un Web Worker del navegador. No requiere otro servicio de Render ni envía el archivo al servidor.

La geometría vuelve como buffers transferibles, conservando colores, nombres, unidades, posiciones y medidas de cada instancia. El XML de la malla se lee por eventos y se almacena en buffers numéricos, sin crear un DOM completo de millones de nodos.

Al cambiar de archivo, salir de la página, completar la lectura o fallar, se termina el worker. Hay un límite de 45 segundos y se conservan los límites previos de archivo, XML expandido, piezas y triángulos. Si no puede crearse el worker, se informa el error sin volver al procesamiento bloqueante. GLB y los modelos remotos del catálogo mantienen su ruta de carga.

## Verificación

- Pruebas de geometría transferida: colores estándar/Bambu, normales STL, instancias compartidas, transformaciones, medidas y rechazo de XML inválido/DTD/índices/ciclos.
- Prueba de navegador con trabajo CPU deliberado dentro del worker: reemplazar el archivo sigue funcionando y termina el worker anterior.
- Archivo real `santa_ams_entero.3mf` (17.653.909 bytes): tres aperturas locales de 5,98; 6,12 y 5,99 segundos. Durante ellas el hilo principal atendió 293–300 pulsos de un temporizador de 20 ms. La tarea larga mayor observada fue de 118 ms, frente al bloqueo anterior de 15–17 segundos. Se verificó un botón interactivo durante la lectura.
- Cero workers y cero canvas activos después de cada cierre en esa prueba. Medidas: 52,605 × 67,818 × 42,688 mm. El estado de colores desconocidos para pintura segmentada sigue generando la advertencia existente; no se promete reconstrucción de colores no soportados.
- Equipo de referencia: Chrome 157, Windows, Intel UHD, DPR 1,5, viewport 1280 × 720. Son mediciones locales del componente compilado, no una garantía para todos los teléfonos ni una medición de Render/Cloudinary. El primer render todavía puede producir una pausa breve al subir una malla muy detallada a la GPU.
