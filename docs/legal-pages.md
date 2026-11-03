# Páginas públicas para Mundo 3D

Datos públicos proporcionados por el responsable:

- Nombre de la marca: Mundo 3D.
- Responsable: Luis Alberto Gómez.
- País de operación: Argentina.
- Contacto público: gomito724@gmail.com.

## URLs para Google Auth Platform

- Página principal: `https://impresion-3d.onrender.com/`
- Política de privacidad: `https://impresion-3d.onrender.com/politica-de-privacidad`
- Condiciones: `https://impresion-3d.onrender.com/terminos-y-condiciones`

El contenido y los datos de contacto se mantienen en `packages/shared/legal.js`. Cuando se cree un correo exclusivo, actualizar allí el contacto y las referencias que aparecen en los textos, cambiar también el correo correspondiente en Google Auth Platform y desplegar. El logo de Google se gestiona aparte en Información de marca.

## Alcance

Los textos describen las funciones existentes: cuentas por email y acceso social, datos de pedidos, cookie de sesión, carrito y borradores locales, infraestructura, correo cuando se configure y contacto mediante WhatsApp. No se afirma que el sitio procese tarjetas, que Facebook esté habilitado, ni que exista eliminación automática de cuentas. Las solicitudes de acceso, rectificación o eliminación se reciben por correo y requieren gestión del responsable. La sección `/politica-de-privacidad#eliminacion-de-datos` explica el procedimiento; no es un callback automático de eliminación de Meta.

Las condiciones describen el carrito como solicitud, la confirmación manual del pedido y del pago, los plazos acordados y los derechos legales que puedan corresponder, sin excluir de forma general garantías ni devoluciones. No se inventa domicilio, CUIT ni una certificación de cumplimiento. Al formalizar la actividad comercial, corresponde revisar esos datos y los requisitos de información al consumidor con asesoramiento adecuado.

## Accesibilidad pública y mantenimiento

Ambas páginas tienen enlaces en el footer y en el acceso a la cuenta. El servidor coloca el contenido legal en el HTML inicial para que pueda leerse sin ejecutar JavaScript ni iniciar sesión; React mantiene luego la navegación del sitio y el enlace Volver. No se requiere una sesión ni se crea una cookie para leer el contenido estático. Los títulos y el nombre visible usan Mundo 3D.

Pruebas: HTTP público sin autenticación, contenido y contacto en HTML, ausencia de cookie, navegación desde el footer, recarga, Atrás, pantallas de 320 a 1280 px y navegador con JavaScript deshabilitado. Estas comprobaciones técnicas no sustituyen una revisión jurídica ni garantizan la aprobación de marca o dominio por Google.
