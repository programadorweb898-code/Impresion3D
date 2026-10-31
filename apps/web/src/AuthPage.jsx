import { useEffect, useState } from 'react';
import { api } from './api.js';
function ProviderLogo({ provider }) {
  return provider === 'google' ? (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.88-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59A5.98 5.98 0 0 1 12 5.95Z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="white"
        d="M16.7 15.47 17.23 12h-3.32V9.75c0-.95.47-1.88 1.95-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.54 1.66-4.54 4.67V12H7.1v3.47h3.05V24a12 12 0 0 0 3.76 0v-8.53Z"
      />
    </svg>
  );
}
const providerErrors = {
  unavailable: 'Este método de acceso todavía no está disponible.',
  cancelled:
    'No se completó el acceso. Podés intentarlo de nuevo o ingresar con tu correo.',
  email:
    'El proveedor no compartió un correo válido. Usá email y contraseña o revisá los permisos de tu cuenta.',
  existing:
    'Ya existe una cuenta con ese correo. Ingresá usando el método con el que la creaste.',
  provider:
    'No pudimos completar el acceso con el proveedor. Intentá nuevamente.',
};
export function AuthPage({
  auth,
  setAuth,
  submitAuth,
  error,
  clearError,
  busy,
  onBack,
}) {
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('reset') || '',
  );
  const [mode, setMode] = useState(() =>
    location.hash.startsWith('#reset=') ? 'reset' : 'account',
  );
  const [options, setOptions] = useState(null);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState(
    () =>
      providerErrors[new URLSearchParams(location.search).get('authError')] ||
      '',
  );
  const [working, setWorking] = useState(false);
  useEffect(() => {
    // Keep reset secrets out of browser history, referrers, and subsequent navigations.
    if (location.hash || location.search)
      window.history.replaceState(null, '', '/login');
    api('/auth/options')
      .then(setOptions)
      .catch(() =>
        setOptions({ google: false, facebook: false, recovery: false }),
      );
  }, []);
  useEffect(() => {
    const readResetLink = () => {
      const nextToken = new URLSearchParams(location.hash.slice(1)).get(
        'reset',
      );
      if (nextToken) {
        setToken(nextToken);
        setMode('reset');
        setLocalError('');
        setMessage('');
        window.history.replaceState(null, '', '/login');
      }
    };
    window.addEventListener('hashchange', readResetLink);
    return () => window.removeEventListener('hashchange', readResetLink);
  }, []);
  function changeMode(next) {
    setMode(next);
    setLocalError('');
    setMessage('');
    clearError();
  }
  async function recover(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === 'reset' && form.password !== form.confirmPassword) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }
    setWorking(true);
    setLocalError('');
    setMessage('');
    try {
      const response = await api(
        '/auth/' + (mode === 'forgot' ? 'forgot-password' : 'reset-password'),
        {
          method: 'POST',
          body: JSON.stringify(
            mode === 'forgot'
              ? { email: form.email }
              : { token, password: form.password },
          ),
        },
      );
      setMessage(response.message);
      if (mode === 'reset') {
        setMode('account');
        setAuth('login');
      }
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setWorking(false);
    }
  }
  const disabled = busy || working;
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <button className="login-back" disabled={disabled} onClick={onBack}>
          ← Volver al catálogo
        </button>
        <p className="auth-brand">
          <span aria-hidden="true">✳</span> impresión<span>3D</span>
        </p>
        <h1 id="login-title">
          {mode === 'forgot'
            ? 'Recuperá tu cuenta'
            : mode === 'reset'
              ? 'Tu nueva contraseña'
              : auth === 'register'
                ? 'Creá tu cuenta'
                : 'Qué bueno verte'}
        </h1>
        {(localError || error) && (
          <p role="alert" className="error">
            {localError || error}
          </p>
        )}
        {message && (
          <p role="status" className="auth-message">
            {message}
          </p>
        )}
        {mode === 'account' ? (
          <>
            <p className="auth-intro">
              {auth === 'register'
                ? 'Elegí cómo querés crear tu cuenta.'
                : 'Ingresá con tu método de siempre.'}
            </p>
            <div className="social-access">
              {['google', 'facebook'].map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className="social-button"
                  disabled={disabled || !options?.[provider]}
                  onClick={() => {
                    window.location.assign('/api/auth/' + provider + '/start');
                  }}
                >
                  <ProviderLogo provider={provider} />
                  Continuar con {provider === 'google' ? 'Google' : 'Facebook'}
                  {options && !options[provider] && (
                    <span className="social-soon">Próximamente</span>
                  )}
                </button>
              ))}
            </div>
            <div className="auth-divider">
              <span>o con tu email</span>
            </div>
            <form onSubmit={submitAuth}>
              {auth === 'register' && (
                <label>
                  Nombre
                  <input
                    name="name"
                    autoComplete="name"
                    minLength="2"
                    maxLength="80"
                    required
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  minLength={auth === 'register' ? 12 : 1}
                  maxLength="128"
                  autoComplete={
                    auth === 'register' ? 'new-password' : 'current-password'
                  }
                  required
                />
              </label>
              {auth === 'register' ? (
                <p className="small">Usá al menos 12 caracteres.</p>
              ) : (
                <a
                  className="forgot-link"
                  href="#recuperar"
                  onClick={(e) => {
                    e.preventDefault();
                    changeMode('forgot');
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              )}
              <button className="primary" disabled={disabled}>
                {busy
                  ? 'Procesando…'
                  : auth === 'register'
                    ? 'Crear cuenta con email'
                    : 'Ingresar'}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setAuth(auth === 'register' ? 'login' : 'register');
                  setLocalError('');
                  setMessage('');
                  clearError();
                }}
              >
                {auth === 'register' ? 'Ya tengo cuenta' : 'Crear una cuenta'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={recover}>
            <p className="auth-intro">
              {mode === 'forgot'
                ? 'Te enviaremos un enlace para elegir una nueva contraseña.'
                : 'Elegí una contraseña de al menos 12 caracteres.'}
            </p>
            {mode === 'forgot' ? (
              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  Nueva contraseña
                  <input
                    name="password"
                    type="password"
                    minLength="12"
                    maxLength="128"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  Confirmar contraseña
                  <input
                    name="confirmPassword"
                    type="password"
                    minLength="12"
                    maxLength="128"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </>
            )}
            <button className="primary" disabled={disabled}>
              {working
                ? 'Procesando…'
                : mode === 'forgot'
                  ? 'Enviar enlace de recuperación'
                  : 'Guardar nueva contraseña'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                changeMode('account');
                setAuth('login');
              }}
            >
              Volver a iniciar sesión
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
