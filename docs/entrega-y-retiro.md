# Entregas propias — SomosMundo3D

El carrito ofrece únicamente entrega por auto propio a domicilio. Los pedidos históricos conservan su modalidad original.
**Zipnova no está integrado ni es necesario para este servicio.**

## Cotización y condiciones

El comprador ingresa calle y altura y CP de destino, y selecciona provincia y localidad del listado oficial de Georef. El catálogo local contiene 4.037 localidades de las 24 jurisdicciones; no depende de consultas externas mientras el cliente busca. La selección no modifica el límite de cobertura de 30 km. Al elegir
«Calcular envío», el backend llama a Google Maps Routes API para recorrer en auto
**origen → domicilio → origen**, con parada intermedia en el domicilio. Se cobran
$400 ARS por km de recorrido total, con mínimo $2.000 ARS. En compras de productos
desde $120.000 ARS, el costo del envío es $0. El recorrido de ida debe ser de
hasta 30 km inclusive. La cotización vence a los 10 minutos.

El total de los pedidos nuevos es subtotal de productos + envío. Se guarda el
desglose y distancia del presupuesto confirmado. Pedidos anteriores conservan su
historial y se diferencian según el estado anterior `pending_quote`.

## Configuración privada en Render (solo backend)

- `GOOGLE_MAPS_API_KEY`: clave restringida a Routes API y protegida como secreto.
- `DELIVERY_ORIGIN_ADDRESS`: dirección/intersección de partida en Rafael Castillo,
  Provincia de Buenos Aires, Argentina. **No publicar la ubicación privada en el
  repositorio ni en variables VITE_**.
- Activar la facturación y Routes API en el proyecto Google Cloud. Revisar límites
  y cuotas directamente en Google Cloud antes de habilitar producción.

Si falta alguna variable, el servidor devuelve 503 y no ofrece una cotización ficticia.

## Consumo y seguridad

El endpoint exige sesión iniciada, CSRF y límites por IP. Guarda como máximo
250 solicitudes a la API de rutas por día UTC mediante un contador en MongoDB,
compartido entre instancias. Es un límite de aplicación; configurar **también**
las cuotas de Google Cloud y alertas de facturación (un presupuesto no corta gastos).
No se realiza una nueva solicitud a Google al confirmar un pedido: se valida
la cotización temporal guardada en la sesión contra usuario, domicilio, carrito
y subtotal calculado por el servidor. No se acepta precio de envío del cliente.

Las tarifas y umbrales están centralizados en `SHIPPING_POLICY` y podrán migrarse
a administración en una etapa posterior. El cliente nunca recibe la dirección
privada de origen. No se factura ni cobra online: el total sirve para coordinar el pago.

> Nota: La disponibilidad del camino y la precisión de una dirección dependen
> de Google Maps. La interfaz requiere calle con altura y CP; el resultado debe
> confirmarse antes del reparto.

## Listado de localidades

Fuente: [Servicio oficial Georef](https://www.argentina.gob.ar/georef).
Copia consultada el 10/11/2026 mediante `localidades?max=5000&campos=id,nombre,provincia,departamento&orden=nombre`.
Se conserva en `packages/shared/localities.json`; la interfaz lo carga al abrir el carrito.
Cada opción incluye partido o departamento para distinguir nombres repetidos.
El servidor comprueba los IDs y su correspondencia con la provincia y el nombre;
la cotización se invalida al cambiar esa selección. Provincia y localidad se
conservan en el pedido junto al domicilio. No se completan códigos postales a partir
de la localidad porque una localidad puede tener varios.
