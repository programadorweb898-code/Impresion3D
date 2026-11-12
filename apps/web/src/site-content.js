import { legalSite } from '@impresion3d/shared';

// Public business contacts. Never substitute a guessed social media account.
export const siteContact = {
  email: legalSite.email,
  phone: '+54 9 11 5560-6321',
  phoneHref: 'tel:+5491155606321',
  whatsapp: '5491155606321',
  instagram: import.meta.env.VITE_INSTAGRAM_URL || '',
  facebook: import.meta.env.VITE_FACEBOOK_URL || '',
};
export const informationPages = {
  about: { path: '/sobre-nosotros', title: 'Sobre nosotros' },
  faq: { path: '/faq', title: 'Preguntas frecuentes' },
};
export const commonQuestions = [
  {
    question: '¿Cómo hago un pedido?',
    answer:
      'Explorá el catálogo, iniciá sesión y agregá las piezas al carrito. Al enviar la solicitud revisamos la disponibilidad y coordinamos los detalles con vos antes de confirmar el pedido.',
  },
  {
    question: '¿Puedo solicitar una impresión con una foto?',
    answer:
      'Sí. En “Diseño personalizado” iniciá sesión, subí una imagen JPG, PNG o WebP, indicá la cantidad y contanos los detalles. Evaluamos si es viable imprimirlo y te enviamos un presupuesto.',
  },
  {
    question: '¿Cuánto tarda la fabricación?',
    answer:
      'El plazo de fabricación es de 2 a 4 días hábiles, según la complejidad del diseño, el tamaño y la cantidad de piezas. Te confirmamos la fecha estimada antes de reservar el trabajo.',
  },
  {
    question: '¿Hay que pagar una reserva para empezar el trabajo?',
    answer:
      'Sí. Para reservar tu trabajo y comenzar la fabricación se debe abonar el 30 % del total como mínimo. El saldo restante se coordina antes de la entrega.',
  },
  {
    question: '¿Cómo recibo el presupuesto de mi diseño?',
    answer:
      'Revisamos tu imagen de referencia y la viabilidad de impresión. Elegís recibir el presupuesto por correo electrónico o WhatsApp, y también podés ver el estado en “Mis solicitudes”. Enviar la imagen no confirma una compra.',
  },
  {
    question: '¿Cómo se coordinan el pago y la entrega?',
    answer:
      'Realizamos entregas a domicilio en auto hasta 30 km de ida desde Rafael Castillo (CP 1755). Para cotizar ingresá calle y altura, seleccioná provincia y localidad, y completá el CP. El carrito suma productos más envío antes de enviar el pedido. El envío es gratis desde $120.000 en productos. El sitio no cobra pagos online.',
  },
  {
    question: '¿Necesito saber diseñar en 3D para consultar?',
    answer:
      'No. Podés enviarnos una foto o imagen de referencia. Si necesitás colores, tamaños o detalles específicos, escribilos en la solicitud. Te confirmaremos qué se puede fabricar.',
  },
];

export function internalLink(event, action) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  action();
}
export function socialLinks(contact = siteContact) {
  return [
    ['Instagram', contact.instagram, 'instagram.com'],
    ['Facebook', contact.facebook, 'facebook.com'],
  ].filter(([, value, domain]) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        (url.hostname === domain || url.hostname === 'www.' + domain)
      );
    } catch {
      return false;
    }
  });
}
