const message =
  '¡Hola! Quisiera consultar sobre sus productos e impresiones 3D.';
export function WhatsAppButton({ phone }) {
  const number = String(phone || '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(number)) return null;
  return (
    <a
      className="whatsapp-float"
      href={'https://wa.me/' + number + '?text=' + encodeURIComponent(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultanos por WhatsApp (se abre en una nueva pestaña)"
      title="Consultanos por WhatsApp"
    >
      <svg
        viewBox="0 0 32 32"
        width="32"
        height="32"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16 .8A15.1 15.1 0 0 0 2.9 23.4L.8 31.2l8-2.1A15.1 15.1 0 1 0 16 .8Zm0 27.6c-2.3 0-4.5-.6-6.4-1.8l-.5-.3-4.7 1.2 1.2-4.6-.3-.5A12.5 12.5 0 1 1 16 28.4Zm6.9-9.4c-.4-.2-2.2-1.1-2.5-1.2-.4-.1-.6-.2-.9.2-.2.4-1 1.2-1.2 1.4-.2.3-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7.4-.6c.1-.3 0-.5 0-.7l-1.1-2.6c-.3-.7-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5s-1.3 1.3-1.3 3.1c0 1.9 1.4 3.7 1.6 3.9.2.3 2.7 4.1 6.4 5.7.9.4 1.6.6 2.1.7.9.3 1.7.2 2.3.2.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.3-.3-.7-.5Z" />
      </svg>
    </a>
  );
}
