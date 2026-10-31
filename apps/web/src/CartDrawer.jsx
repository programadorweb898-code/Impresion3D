import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export function CartDrawer({ onClose, busy, error, children, returnFocusRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() =>
        returnFocusRef?.current?.focus({ preventScroll: true }),
      );
    };
  }, []);
  return createPortal(
    <dialog
      className="cart-drawer"
      ref={ref}
      aria-labelledby="cart-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="cart-drawer-header">
        <span className="eyebrow">TUS PRÓXIMAS PIEZAS</span>
        <button
          type="button"
          className="drawer-close"
          aria-label="Cerrar carrito"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="cart-drawer-content">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
