// Public contact information, supplied by the owner. Update here when the
// dedicated Mundo 3D email becomes available; these values are not secrets.
export const legalSite = {
  name: 'Mundo 3D',
  responsible: 'Luis Alberto Gómez',
  country: 'Argentina',
  email: 'gomito724@gmail.com',
  updated: '8 de noviembre de 2026',
};
export const legalPages = {
  privacy: {
    path: '/politica-de-privacidad',
    title: 'Política de privacidad',
    introduction:
      'Esta política explica qué datos personales trata Mundo 3D al usar el sitio, crear una cuenta, consultar productos o enviar una solicitud de pedido.',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable y contacto',
        paragraphs: [
          'El responsable del tratamiento es Luis Alberto Gómez, quien opera Mundo 3D desde Argentina. Para consultas sobre privacidad y ejercicio de derechos, el contacto es gomito724@gmail.com.',
        ],
      },
      {
        id: 'datos',
        title: '2. Datos que se tratan',
        items: [
          'Solicitudes de presupuesto 3D: archivo original, nombre del archivo, cantidad, escala y medidas solicitadas, uso indicado, estado de revisión de colores y aceptación de continuar con colores pendientes. La vista previa se procesa localmente; el archivo se guarda solo al enviar la solicitud y su descarga requiere la cuenta del solicitante o acceso de administración.',
          'Datos de cuenta: nombre, correo electrónico, identificador interno y estado de la cuenta. Si elegís email y contraseña, se conserva una representación protegida de la contraseña mediante hash, no su texto original.',
          'Acceso social: nombre, correo e identificador que proporciona Google o, cuando esté habilitado, Facebook. Google no comparte tu contraseña con Mundo 3D. No solicitamos acceso a Gmail, Drive, contactos ni al contenido privado de esas cuentas.',
          'Pedidos y consultas: productos, cantidades, importes, comentarios, estados y datos que nos comuniques para coordinar la fabricación o entrega. El sitio no procesa pagos online ni solicita números de tarjeta.',
          'Datos técnicos necesarios para prestar y proteger el servicio, como registros de errores, sesión y solicitudes de acceso; los proveedores de infraestructura pueden procesar dirección IP e información del navegador.',
        ],
      },
      {
        id: 'finalidades',
        title: '3. Para qué se usan',
        paragraphs: [
          'Los datos se utilizan para crear y autenticar la cuenta, conservar el carrito y los pedidos, responder consultas, coordinar presupuestos, fabricación, pago y entrega, y gestionar reclamos o solicitudes sobre tus datos.',
          'También se utilizan para verificar correos, recuperar el acceso, enviar comunicaciones relacionadas con la cuenta o el pedido cuando el servicio esté habilitado, prevenir usos indebidos y cumplir obligaciones legales. No se venden datos personales ni se usan los datos obtenidos de Google para publicidad personalizada.',
          'La información necesaria para gestionar una cuenta o un pedido se solicita al realizar esa acción. Podés explorar el catálogo sin registrarte; para armar el carrito y enviar un pedido se necesita iniciar sesión.',
        ],
      },
      {
        id: 'proveedores',
        title: '4. Servicios de terceros',
        paragraphs: [
          'Mundo 3D utiliza proveedores tecnológicos para operar. Se comparten o procesan los datos necesarios para las funciones correspondientes:',
        ],
        items: [
          'Render: alojamiento del sitio y de su servidor.',
          'MongoDB Atlas: almacenamiento de cuentas, sesiones, pedidos y solicitudes de presupuesto, incluidos los archivos originales privados.',
          'Cloudinary: almacenamiento y entrega de imágenes y archivos de los productos.',
          'Google y, si se habilita, Meta/Facebook: identificación cuando elegís sus botones de acceso. El correo de contacto publicado utiliza Gmail.',
          'Resend, cuando se configura: envío de correos de cuenta, recuperación y avisos relacionados con pedidos.',
          'WhatsApp: cuando abrís el enlace de contacto y decidís enviar un mensaje, la comunicación se realiza mediante ese servicio y queda sujeta a sus condiciones y privacidad.',
        ],
        after: [
          'Estos proveedores pueden operar o alojar información fuera de Argentina. Podés solicitar al responsable información sobre los destinatarios y el tratamiento internacional de los datos. Los servicios externos también tienen sus propias políticas de privacidad.',
        ],
      },
      {
        id: 'cookies',
        title: '5. Cookies y almacenamiento del navegador',
        paragraphs: [
          'Se utiliza una cookie de sesión necesaria para mantener el acceso a la cuenta y proteger las operaciones. La duración máxima configurada de esa sesión es de siete días; cerrar sesión la invalida.',
          'El carrito y los borradores de envío se guardan en el almacenamiento local del navegador, separados por cuenta. El carrito se vacía al confirmar el pedido o mediante su opción de vaciado; también podés borrar estos datos desde la configuración del navegador. No se sincronizan automáticamente entre dispositivos.',
          'El sitio no incorpora herramientas propias de publicidad comportamental. Al acceder a servicios como Google o WhatsApp, esos proveedores pueden utilizar sus propias cookies conforme a sus políticas. Bloquear las cookies necesarias puede impedir iniciar sesión o enviar pedidos.',
        ],
      },
      {
        id: 'conservacion',
        title: '6. Conservación y seguridad',
        paragraphs: [
          'La información se conserva mientras sea necesaria para administrar la cuenta, gestionar pedidos, resolver consultas o reclamos y cumplir los plazos legales aplicables. Una solicitud de eliminación puede requerir conservar de forma limitada ciertos registros necesarios para obligaciones legales o reclamos pendientes.',
          'Se aplican controles de acceso, conexiones cifradas y medidas de protección de cuentas y sesiones. Ningún sistema puede garantizar una seguridad absoluta. Los mensajes que envíes por correo o WhatsApp también se procesan en esos servicios.',
        ],
      },
      {
        id: 'derechos',
        title: '7. Acceso, rectificación y otros derechos',
        paragraphs: [
          'De acuerdo con la Ley argentina 25.326 y las normas aplicables, podés solicitar acceso a tus datos, rectificación, actualización o supresión, y retirar los consentimientos que correspondan. El acceso a datos personales es gratuito en los casos y con la periodicidad previstos por la ley.',
          'Enviá tu solicitud a gomito724@gmail.com indicando el derecho que querés ejercer y el correo de la cuenta. Podremos pedir información razonable para verificar tu identidad. No te solicitaremos la contraseña del sitio ni de Google. Atenderemos la solicitud conforme a los plazos y condiciones legales.',
          'La Agencia de Acceso a la Información Pública (AAIP) es la autoridad argentina de control en materia de protección de datos personales y recibe consultas y denuncias.',
        ],
        link: {
          href: 'https://www.argentina.gob.ar/aaip/datospersonales',
          label: 'Información sobre protección de datos personales de la AAIP',
        },
      },
      {
        id: 'eliminacion-de-datos',
        title: '8. Cómo solicitar la eliminación de la cuenta',
        paragraphs: [
          'Escribí a gomito724@gmail.com con el asunto “Eliminar mi cuenta de Mundo 3D”, preferentemente desde el correo asociado a la cuenta. Indicá que solicitás la eliminación de la cuenta y de los datos personales vinculados.',
          'Luego de verificar tu identidad, gestionaremos la baja y la eliminación o disociación de los datos que corresponda. Si ciertos registros deben conservarse por una obligación legal o un reclamo pendiente, se informará el motivo.',
          'Si ingresaste con Google o Facebook, también podés quitar el permiso de Mundo 3D desde la configuración de aplicaciones conectadas de ese proveedor. Quitar el permiso y solicitar la eliminación en Mundo 3D son acciones diferentes; para pedir la eliminación en este sitio utilizá el correo indicado.',
        ],
        emailSubject: 'Eliminar mi cuenta de Mundo 3D',
        emailLabel: 'Solicitar eliminación de cuenta y datos',
      },
      {
        id: 'cambios',
        title: '9. Cambios y consultas',
        paragraphs: [
          'Esta política puede actualizarse cuando cambien las funciones, los proveedores o las obligaciones aplicables. La fecha de actualización se muestra al inicio. Si un cambio requiere informar u obtener un consentimiento adicional, se realizará antes del nuevo tratamiento que lo requiera.',
          'Para cualquier consulta, contactá a Luis Alberto Gómez en gomito724@gmail.com.',
        ],
      },
    ],
  },
  terms: {
    path: '/terminos-y-condiciones',
    title: 'Términos y condiciones',
    introduction:
      'Estas condiciones describen el uso de Mundo 3D y la gestión de solicitudes de productos realizados mediante impresión 3D. Se interpretan conforme a la normativa argentina aplicable y sin limitar derechos de los consumidores.',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable del sitio',
        paragraphs: [
          'Mundo 3D es administrado por Luis Alberto Gómez, quien opera desde Argentina. El correo de contacto para consultas, pedidos y reclamos es gomito724@gmail.com.',
        ],
      },
      {
        id: 'uso',
        title: '2. Uso del sitio y de la cuenta',
        paragraphs: [
          'El catálogo puede consultarse sin crear una cuenta. Para armar un carrito o enviar una solicitud de pedido se requiere iniciar sesión. Debés proporcionar datos veraces, mantener actualizada la información necesaria para el pedido y resguardar tus medios de acceso.',
          'El sitio debe utilizarse de forma lícita, sin intentar acceder a cuentas ajenas, alterar precios, afectar el servicio o vulnerar derechos de terceros. Podés solicitar ayuda o la baja de tu cuenta mediante el correo de contacto.',
        ],
      },
      {
        id: 'productos',
        title: '3. Productos, imágenes y medidas',
        paragraphs: [
          'La ficha de cada producto muestra su descripción, medidas y precio disponible. Las medidas se expresan en milímetros salvo indicación diferente. Las fotografías y visualizaciones ayudan a comprender el diseño; los colores en pantalla pueden variar respecto de la pieza física.',
          'Las piezas realizadas por impresión 3D pueden presentar líneas de capa y variaciones propias del proceso. Los accesorios utilizados para ilustrar el uso de un producto no forman parte de la oferta salvo que la descripción lo indique expresamente.',
          'Antes de confirmar un encargo, consultá las características importantes para el uso que querés darle. No se atribuyen al producto aptitudes médicas, alimentarias, estructurales u otras certificaciones que no estén indicadas y confirmadas expresamente.',
        ],
      },
      {
        id: 'pedidos',
        title: '4. Solicitudes y confirmación',
        paragraphs: [
          'Agregar productos al carrito o enviar una solicitud no equivale por sí solo a una compra aceptada ni reserva automáticamente existencias. La disponibilidad, viabilidad, características definitivas y condiciones del encargo se revisan y coordinan personalmente.',
          'Antes de confirmar la compra se comunicarán el producto acordado, la cantidad, el importe total, las condiciones de pago, el plazo y la modalidad de entrega. Si se acuerda un diseño personalizado, también se definirán las medidas, colores, archivos o especificaciones y las aprobaciones necesarias antes de fabricarlo.',
        ],
      },
      {
        id: 'precios',
        title: '5. Precios y pagos',
        paragraphs: [
          'Los precios del catálogo se muestran en pesos argentinos (ARS), salvo indicación expresa de otra moneda. El sitio comprueba precios y disponibilidad al enviar una solicitud. Si existe una modificación antes de confirmar el encargo, se informará para que puedas decidir si continuar.',
          'Los costos de envío u otros conceptos aplicables se comunicarán antes de formalizar la compra. Una modificación posterior no cambia el importe de una compra ya confirmada sin el acuerdo que corresponda.',
          'Actualmente no se realizan pagos online dentro del sitio. El medio y las condiciones de pago se coordinan personalmente antes de confirmar la operación.',
        ],
      },
      {
        id: 'entrega',
        title: '6. Fabricación y entrega',
        paragraphs: [
          'Los plazos de fabricación y entrega se informan para cada pedido según el diseño, la cantidad y la disponibilidad. Las estimaciones mostradas en el seguimiento no reemplazan la fecha y las condiciones acordadas.',
          'La modalidad de retiro o envío se define antes de confirmar el pedido. Si surge un inconveniente que afecte lo acordado, se informará para resolverlo de acuerdo con la normativa aplicable.',
        ],
      },
      {
        id: 'reclamos',
        title: '7. Garantías, devoluciones y revocación',
        paragraphs: [
          'Podés comunicar defectos, diferencias con lo acordado o cualquier inconveniente al correo gomito724@gmail.com, indicando el pedido y el problema observado. Adjuntar fotografías puede ayudar a evaluarlo.',
          'Se respetan las garantías y los derechos de los consumidores establecidos por la Ley 24.240, el Código Civil y Comercial y las demás normas aplicables. Estas condiciones no eliminan ni reducen esos derechos.',
          'En las contrataciones a distancia, el derecho de revocación o arrepentimiento se aplica en los casos y plazos previstos legalmente, generalmente diez días corridos cuando corresponda. Los bienes confeccionados según especificaciones del consumidor o claramente personalizados pueden estar sujetos a excepciones legales; esa condición debe informarse antes de confirmar el encargo.',
          'Para ejercer un derecho o solicitar una devolución, contactá al responsable para gestionar el caso según corresponda.',
        ],
        emailSubject: 'Consulta o reclamo sobre un pedido de Mundo 3D',
        emailLabel: 'Contactar por un pedido, devolución o reclamo',
      },
      {
        id: 'privacidad',
        title: '8. Privacidad',
        paragraphs: [
          'El tratamiento de datos personales, los servicios de terceros, las cookies necesarias y las solicitudes de acceso o eliminación se explican en la Política de privacidad.',
        ],
        link: {
          href: '/politica-de-privacidad',
          label: 'Leer la Política de privacidad',
        },
      },
      {
        id: 'actualizaciones',
        title: '9. Actualizaciones y normativa aplicable',
        paragraphs: [
          'Las actualizaciones de estas condiciones se publicarán en esta página con su fecha. Los cambios no se aplican retroactivamente para alterar una compra ya confirmada.',
          'Se aplica la legislación argentina y se respetan las reglas de competencia y los mecanismos de protección del consumidor que correspondan. Para consultas sobre estas condiciones, escribí a gomito724@gmail.com.',
        ],
      },
    ],
  },
};
export function legalPageFromPath(path) {
  const normalized = path.replace(/\/$/, '');
  return (
    Object.keys(legalPages).find(
      (key) => legalPages[key].path === normalized,
    ) || null
  );
}
