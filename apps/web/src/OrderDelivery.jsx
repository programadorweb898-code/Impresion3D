import { formatMoney as money } from '@impresion3d/shared';
export function OrderDelivery({ delivery }) {
  if (!delivery) return <p>Modalidad de entrega a coordinar.</p>;
  return delivery.method === 'pickup' ? (
    <div className="order-delivery">
      <p>
        <strong>Retiro coordinado — Gratis</strong> · CP{' '}
        {delivery.originPostalCode}
      </p>
      <p>Coordinaremos el lugar y horario cuando el pedido esté listo.</p>
    </div>
  ) : (
    <div className="order-delivery">
      <p>
        <strong>Entrega a domicilio</strong> · Código postal{' '}
        {delivery.postalCode}
      </p>
      {delivery.status === 'quoted' ? (
        <>
          <p>
            {delivery.streetAddress}, {delivery.city}
            {delivery.province ? ', ' + delivery.province : ''}
          </p>
          <p>
            Ida: {(delivery.oneWayMeters / 1000).toFixed(1)} km · Ida y vuelta:{' '}
            {(delivery.roundTripMeters / 1000).toFixed(1)} km
          </p>
          <p>
            Costo de entrega:{' '}
            {delivery.costCents === 0
              ? 'Gratis'
              : money(delivery.costCents, 'ARS')}
          </p>
        </>
      ) : (
        <p>
          Costo de envío a confirmar. El importe de productos no incluye el
          envío.
        </p>
      )}
    </div>
  );
}
