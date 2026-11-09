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
  faq: { path: '/preguntas-frecuentes', title: 'Preguntas frecuentes' },
};
export const commonQuestions = [
  {
    question: '¿Cómo hago un pedido?',
    answer:
      'Explorá el catálogo, iniciá sesión y agregá las piezas al carrito. Al enviar la solicitud revisamos la disponibilidad y coordinamos los detalles con vos antes de confirmar el pedido.',
  },
  {
    question: '¿Puedo enviar mi propio modelo 3D?',
    answer:
      'Sí. En “Subí tu diseño” podés cargar un archivo 3MF, STL o GLB, revisar su vista previa, ajustar las medidas de forma proporcional e indicar la cantidad. Iniciá sesión para enviar la solicitud de presupuesto.',
  },
  {
    question: '¿Cuánto tarda la fabricación?',
    answer:
      'El plazo depende del diseño, el tamaño, la cantidad y los trabajos pendientes. Te informamos el plazo estimado al revisar tu solicitud y acordamos la entrega antes de confirmar el encargo.',
  },
  {
    question: '¿Cómo recibo el presupuesto de mi diseño?',
    answer:
      'Revisamos el archivo y su viabilidad de impresión. Podés consultar el estado y nuestra respuesta en “Mis solicitudes”, dentro de “Subí tu diseño”. Enviar el archivo no confirma una compra.',
  },
  {
    question: '¿Cómo se coordinan el pago y la entrega?',
    answer:
      'Coordinamos personalmente el medio de pago y la modalidad de retiro o envío antes de confirmar el pedido. El sitio no cobra pagos online. Si corresponde un costo de envío, te lo informamos antes de confirmar.',
  },
  {
    question: '¿Qué pasa si el modelo no tiene colores definidos?',
    answer:
      'Si detectamos colores sin asignar o no podemos comprobarlos, el sitio te avisa antes del envío. Podés enviarlo igual para que lo revisemos o cancelar. El blanco definido en el archivo se considera un color válido.',
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
