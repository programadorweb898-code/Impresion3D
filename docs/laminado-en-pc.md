# Laminado en la PC de Mundo 3D

El sitio conserva los originales y las solicitudes. Un proceso Node.js en la PC descarga solo el trabajo que tiene asignado, ejecuta Bambu Studio por comandos y devuelve gramos, segundos y cantidad de placas. Nunca contacta la impresora ni inicia una impresión. El precio queda como borrador hasta que administración guarda la respuesta.

## Activación en Windows

1. Instalá Node.js 24 o posterior y Bambu Studio desde sus sitios oficiales. Abrí Bambu Studio al menos una vez y comprobá que tu Bambu A1 y su boquilla estén configuradas.
2. Prepará perfiles **completos** de máquina, proceso y filamento. La CLI de Bambu no acepta un preset incompleto que solo hereda otro perfil. El perfil de máquina debe ser de **A1, no A1 mini**. Revisá especialmente temperatura, boquilla, altura de capa, paredes, relleno y soportes. Las rutas y los perfiles quedan en la PC.
3. En **Administración → Presupuestos 3D → Laminado en tu PC**, descargá el asistente y el JSON de ejemplo. Completá las rutas del JSON. Para un perfil podés configurar de uno a cuatro filamentos del mismo material; los cuatro pueden apuntar al mismo archivo si sus ajustes son los mismos. El asistente usa solo los necesarios y conserva la paleta de colores del proyecto Bambu.
4. Generá el código de conexión del sitio. En PowerShell, desde la carpeta donde descargaste el asistente, ejecutá:

   ```powershell
   node .\mundo3d-worker.mjs setup
   ```

   Seleccioná la dirección de tu sitio, la ruta del ejecutable de Bambu Studio y el JSON de perfiles, y pegá el código de conexión. El código vence en diez minutos y se utiliza una sola vez. No hace falta pegar credenciales ni claves en un chat.

5. Iniciá el proceso:

   ```powershell
   node .\mundo3d-worker.mjs start
   ```

   Mantené la ventana abierta y la PC encendida y conectada. `Ctrl+C` lo detiene. No se instala como servicio ni se cambia el inicio de Windows.

6. Actualizá las conexiones y las solicitudes en administración. En una solicitud, elegí **PC y perfil de laminado** y presioná **Laminar en mi PC**.
7. **Primera prueba obligatoria de puesta en marcha:** usá un modelo conocido y compará el tiempo, el material, la escala, todas las placas, soportes y purgas con el laminado manual de Bambu Studio. Las pruebas del repositorio validan la cola y el protocolo con una PC simulada; no sustituyen esta comprobación del ejecutable y los perfiles reales de tu PC.

## Cómo interpretar el resultado

- Se lamina una copia completa del archivo, con todas sus placas y la escala proporcional solicitada. Se reorganiza para la bandeja, sin cambiar la orientación automáticamente ni reducir el tamaño para hacer que entre.
- La cantidad se estima como **copias impresas por separado**: consumo y tiempo de una copia por cantidad. No es una optimización de varias copias juntas en una bandeja. No se utilizan `--repetitions` con `--slice 0`, combinación que el código de Bambu rechaza.
- Los datos provienen de `Metadata/slice_info.config` del resultado recién laminado, no de estadísticas anteriores del archivo del cliente. Si falta alguna placa, el tiempo o el peso, el resultado se marca para revisión.
- **Usar estimación como borrador de precio** aplica la fórmula de costos existente. Revisá esos costos y guardá la respuesta para comunicar el precio al cliente. El proceso de la PC no tiene permiso para publicar un presupuesto.
- Esta versión admite STL sin asignación de color y proyectos Bambu 3MF con paleta de hasta cuatro filamentos del mismo material. Los GLB, STL con color y 3MF coloreados sin mapeo Bambu quedan para preparación manual; se rechazan explícitamente antes de producir una estimación que pierda colores.
- La validación del paquete del cliente es una primera revisión. Como con cualquier archivo de impresión recibido, el resultado y los ajustes por objeto deben revisarse en el laminador antes de aceptar la fabricación.

## Conexión y recuperación

El asistente realiza conexiones HTTPS salientes; no abre puertos ni requiere cambiar el router. Usa una credencial limitada al laminado, guardada en `%LOCALAPPDATA%\Mundo3D\slicer-worker.json` en Windows. Se puede revocar desde administración y deja de funcionar al cambiar la versión de autenticación de la cuenta administradora o perder su rol.

Cada trabajo tiene un turno de cinco minutos, renovado cada 45 segundos. Si la PC se apaga, otra ejecución del proceso puede recuperar el trabajo cuando vence el turno. Después de tres intentos interrumpidos, administración debe revisar y volver a encolar. Un resultado de un turno anterior no puede reemplazar uno nuevo. Los archivos de trabajo temporales se eliminan al terminar cada intento; después de un cierre forzado pueden quedar carpetas `mundo3d-slice-*` en la carpeta temporal de Windows.

Si cambian los perfiles, el proceso pide revisarlos y volver a vincular la PC. Para utilizar otro material se agrega otro perfil al JSON y se vuelve a realizar la vinculación. No se mezclan materiales automáticamente.

## Referencias verificadas

- [Bambu Studio: Command Line Usage](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage): perfiles completos, `--load-settings`, `--load-filaments`, `--scale`, `--arrange`, `--slice` y `--export-3mf`.
- [Implementación de la CLI](https://github.com/bambulab/BambuStudio/blob/master/src/BambuStudio.cpp): manejo de transformaciones, perfiles y restricciones de repetición por placa.
