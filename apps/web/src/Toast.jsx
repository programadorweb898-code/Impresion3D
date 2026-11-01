import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Toast({ message, onDismiss }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onDismiss, 200);
    return () => clearTimeout(timer);
  }, [closing, onDismiss]);

  return createPortal(
    <div className="toast-region">
      <div
        className={'toast' + (closing ? ' is-closing' : '')}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <svg
          className="toast-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path
            d="m8 12 2.5 2.5L16 9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="toast-message">{message}</span>
        <button
          type="button"
          className="toast-close"
          aria-label="Cerrar notificación"
          onClick={() => setClosing(true)}
        >
          <svg
            width="18"
            height="18"
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
    </div>,
    document.body,
  );
}
