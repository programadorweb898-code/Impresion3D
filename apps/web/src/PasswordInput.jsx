import { useState } from 'react';
import './PasswordInput.css';

export function PasswordInput({ style, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} style={style} />
      <button
        className="password-visibility"
        type="button"
        disabled={props.disabled}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {visible ? (
            <>
              <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 4.2A11 11 0 0 1 12 4c6 0 10 8 10 8a18 18 0 0 1-3 3.7M6.5 6.5A22 22 0 0 0 2 12s4 8 10 8a10 10 0 0 0 5.5-1.8" />
            </>
          ) : (
            <>
              <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}
