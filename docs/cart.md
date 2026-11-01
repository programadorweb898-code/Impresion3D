# Carrito y pedido con varios productos

El cliente debe ingresar o registrarse **antes de agregar productos**. Si toca Agregar al carrito sin sesión, aparece el aviso con opciones para ingresar o seguir explorando. Si toca el ícono del carrito sin sesión, se abre el formulario de acceso y no se modifica ningún carrito. El catálogo y el visor 3D siguen siendo públicos.

## Uso

1. Ingresar y agregar productos desde el catálogo. Cada producto se agrega una sola vez: su botón pasa a «En el carrito» y se deshabilita.
2. Abrir el **ícono del carrito** para mostrar el panel lateral, cambiar cantidades, quitar productos y revisar subtotales y total. Para pedir más unidades, cambiá la cantidad allí; no se vuelve a agregar la tarjeta.
3. Agregar comentarios y pulsar **Enviar pedido**.
4. Consultar el pedido completo en **Mis pedidos**. Administración recibe un único pedido con todos sus artículos.

No hay cobro online. El precio de los productos, el pago y la entrega se coordinan según lo que indica la solicitud; la fecha y el costo de entrega se confirman por separado. El carrito no reserva existencias.

## Persistencia

Se guardan solamente identificadores de productos y cantidades en el almacenamiento local del navegador, con una clave distinta por usuario. Se recuperan al recargar o volver a ingresar con esa cuenta. Al cerrar sesión no se muestran ni se reutilizan en otra cuenta. No se sincronizan entre dispositivos o navegadores. Los comentarios no se conservan al recargar.

El carrito se vacía cuando el servidor confirma el pedido. Los fallos de envío lo conservan. Si la conexión se corta después de enviar, revisá Mis pedidos antes de repetir: el servidor podría haber guardado el pedido aunque no haya llegado la respuesta.

## Validación en el servidor

La API acepta hasta 20 productos diferentes, entre 1 y 20 unidades por producto y comentarios de hasta 1000 caracteres. Rechaza productos repetidos, IDs inválidos, cantidades fuera del rango y carritos vacíos.

El servidor consulta todos los productos activos y calcula sus importes. Ignora precios finales y usuarios enviados por el cliente: el propietario siempre sale de la sesión. Si algún producto no está disponible no se guarda un pedido parcial. Si cambió un precio respecto del mostrado, devuelve un conflicto y el frontend actualiza el catálogo para que el usuario revise el nuevo total.

Cada artículo conserva nombre, precio y medidas del momento del pedido. Los pedidos existentes de un solo producto siguen funcionando; la API admite temporalmente el formato anterior además del nuevo `items`.

Los envíos del nuevo carrito incluyen un UUID `requestId`. Un índice único por usuario evita duplicar un mismo intento, incluso si llegan dos solicitudes simultáneas. Reutilizarlo con otros artículos o comentarios devuelve conflicto. No se reintenta automáticamente una operación de escritura.

## Verificación

`npm test` prueba el pedido multiproducto con MongoDB temporal real: precios, disponibilidad, privacidad, copia histórica, cantidades, reintentos y concurrencia. También valida la lectura del carrito por usuario y el descarte de datos corruptos. La comprobación de navegador usa Express y MongoDB reales, sin crear pedidos en producción.

Si un visitante intenta agregar una pieza, aparece un cuadro con «Crear cuenta o iniciar sesión» y «Continuar explorando». La primera opción abre `/login`, donde también puede crear una cuenta; la segunda cierra el cuadro sin cambiar la página ni el carrito. Escape también permite cerrarlo. `/login` admite acceso directo, recarga y navegación atrás del navegador. No se agrega una pieza antes de autenticar al cliente.

## Navegación adaptable

Debajo de 576 px, el menú hamburguesa muestra las mismas opciones según la sesión y el rol. Se despliega en el flujo de la página y empuja el contenido y el footer hacia abajo. El ícono del carrito y su contador quedan fuera del menú, a la derecha, junto al botón de hamburguesa. Al seleccionar una opción, el menú se cierra. Desde 576 px, la navegación aparece en una fila con `overflow-x: auto` y el carrito permanece visible fuera de esa fila. El sitio no necesita Bootstrap para este comportamiento.

El carrito se abre como un diálogo lateral desde la derecha, conserva cantidades y comentarios y permite enviar el pedido. Atrapa el foco, bloquea el desplazamiento de fondo y se cierra con el botón, Escape o el fondo; al cerrar, devuelve el foco al ícono. Mientras se envía un pedido, el cierre queda deshabilitado. El cuerpo del carrito tiene desplazamiento vertical independiente. Los errores de envío se muestran dentro del panel; un pedido confirmado lo cierra y muestra Mis pedidos. El enlace de acceso sigue abriendo `/login` sin cabecera ni footer; al ingresar desde el carrito vuelve a abrirse el panel.

El menú hamburguesa y el panel lateral animan tanto la apertura como el cierre. El panel permanece montado y mantiene el bloqueo del fondo hasta finalizar el cierre; las preferencias de movimiento reducido evitan las animaciones. La cantidad de cada producto aparece siempre como «Cantidad: N» justo debajo de su nombre, además del selector. El contador del ícono representa productos distintos (`items.length`): cambiar unidades no lo aumenta, agregar otra pieza desde el catálogo sí, y quitar una pieza lo reduce.

## Reintentos y recargas

Antes de enviar se guarda el intento pendiente por usuario en localStorage, incluyendo su clave, productos, comentarios y precios aceptados. Una recarga recupera el intento; reenviar el mismo contenido conserva la clave y recupera el pedido existente. Un cambio de precio confirmado por la API permite preparar otro intento. Al confirmar el pedido se persiste primero el carrito vacío y luego se libera la clave. Si el navegador no permite guardar el intento, no se envía el pedido. Los datos locales no incluyen contraseñas ni cookies.
