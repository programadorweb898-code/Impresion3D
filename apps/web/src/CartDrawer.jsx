import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function CartDrawer({
  open,
  onClose,
  busy,
  error,
  children,
  returnFocusRef,
}) {
  const ref = useRef(null);
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open && !present) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const dialog = ref.current;
    if (!dialog.open) {
      dialog.showModal();
      dialog.style.transform = 'translateX(100%)';
    }
    const end = open ? 'translateX(0)' : 'translateX(100%)';
    const animation = dialog.animate(
      [{ transform: getComputedStyle(dialog).transform }, { transform: end }],
      {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 220,
        easing: 'ease-in-out',
        fill: 'forwards',
      },
    );
    let active = true;
    animation.finished
      .then(() => {
        if (!active) return;
        dialog.style.transform = end;
        animation.cancel();
        if (!open) {
          dialog.close();
          setPresent(false);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      dialog.style.transform = getComputedStyle(dialog).transform;
      animation.cancel();
    };
  }, [open, present]);
  useEffect(() => {
    if (!present) return;
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() =>
        returnFocusRef?.current?.focus({ preventScroll: true }),
      );
    };
  }, [present, returnFocusRef]);
  if (!present) return null;
  const close = () => {
    if (!busy && open) onClose();
  };
  return createPortal(
    <dialog
      className={'cart-drawer' + (!open ? ' is-closing' : '')}
      ref={ref}
      aria-labelledby="cart-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          close();
      }}
    >
      <div className="cart-drawer-header">
        <span className="eyebrow">TUS PRÓXIMAS PIEZAS</span>
        <button
          type="button"
          className="drawer-close"
          aria-label="Cerrar carrito"
          autoFocus
          disabled={busy || !open}
          onClick={close}
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
      <div className="cart-drawer-content" inert={!open}>
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
