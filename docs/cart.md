# Carrito y pedido con varios productos

El cliente debe ingresar o registrarse **antes de agregar productos**. Si toca Agregar al carrito o Carrito sin sesión, se abre el formulario de acceso y no se modifica ningún carrito. El catálogo y el visor 3D siguen siendo públicos.

## Uso

1. Ingresar y agregar productos desde el catálogo. Cada producto se agrega una sola vez: su botón pasa a «En el carrito» y se deshabilita.
2. Abrir **Carrito**, cambiar cantidades, quitar productos y revisar subtotales y total. Para pedir más unidades, cambiá la cantidad allí; no se vuelve a agregar la tarjeta.
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
