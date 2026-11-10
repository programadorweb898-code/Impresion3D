export function OrderDelivery({ delivery }) {
  if (!delivery) return <p>Modalidad de entrega a coordinar.</p>;
  return delivery.method === 'pickup' ? (
    <div className="order-delivery">
      <p>
        <strong>Retiro en tienda — Gratis</strong> · CP{' '}
        {delivery.originPostalCode}
      </p>
      <p>
        Dirección a coordinar al confirmar el pedido. Retirá cuando te avisemos
        que está listo.
      </p>
    </div>
  ) : (
    <div className="order-delivery">
      <p>
        <strong>Envío</strong> · Código postal {delivery.postalCode}
      </p>
      <p>
        Costo de envío a confirmar. El importe de productos no incluye el envío.
      </p>
    </div>
  );
}
