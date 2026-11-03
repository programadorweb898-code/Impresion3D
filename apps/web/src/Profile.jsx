import { useEffect, useState } from 'react';
import { api } from './api.js';
export function Profile({
  user,
  onUser,
  onLogout,
  onLogin,
  confirmationToken,
  onConfirmed,
}) {
  const [profile, setProfile] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api('/profile')
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);
  async function update(event, path, body) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api('/profile' + path, {
        method: path ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      if (path === '' || response.user) {
        const next = response.user || response;
        setProfile(next);
        onUser(next);
      }
      setMessage(response.message || 'Datos actualizados.');
      if (path === '/email/confirm') onConfirmed();
      if (event && path !== '') event.target.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <section className="profile-page">
        <h1>Mi perfil</h1>
        <p>Iniciá sesión para consultar y actualizar tu cuenta.</p>
        <button className="primary" onClick={onLogin}>
          Iniciar sesión
        </button>
      </section>
    );
  if (loading)
    return (
      <section className="profile-page">
        <p role="status">Cargando tu perfil…</p>
      </section>
    );
  if (!profile)
    return (
      <section className="profile-page">
        <h1>Mi perfil</h1>
        <p role="alert" className="error">
          {error || 'No pudimos cargar tu perfil. Recargá la página.'}
        </p>
        <button onClick={onLogin}>Volver a iniciar sesión</button>
      </section>
    );
  const proof = profile.hasPassword ? (
    <label>
      Contraseña actual
      <input
        type="password"
        name="currentPassword"
        autoComplete="current-password"
        maxLength="128"
        required
        disabled={busy}
      />
    </label>
  ) : (
    <p className="small">
      Confirmá tu identidad con tu proveedor antes de cambiar el email o crear
      una contraseña.
    </p>
  );
  return (
    <section className="profile-page">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">TU CUENTA</p>
          <h1>Mi perfil</h1>
          <p>
            Hola, {profile.name}. Administrá tus datos y la seguridad de tu
            cuenta.
          </p>
        </div>
        <button className="outline" disabled={busy} onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
      {confirmationToken && (
        <section className="profile-panel email-confirm">
          <h2>Confirmá tu nuevo email</h2>
          <p>
            Este enlace asociará el correo a tu cuenta actual. Conservás tus
            pedidos y tu método de inicio de sesión.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              update(null, '/email/confirm', { token: confirmationToken })
            }
          >
            Confirmar cambio de email
          </button>
        </section>
      )}
      {!profile.hasPassword && profile.providers.length > 0 && (
        <section className="profile-panel">
          <h2>Confirmar identidad</h2>
          <p>
            Se abrirá tu proveedor de acceso y volverás a esta página. La
            confirmación dura cinco minutos.
          </p>
          <div className="profile-provider-actions">
            {profile.providers.map((provider) => (
              <a
                className="outline"
                key={provider}
                href={
                  '/api/auth/' +
                  provider +
                  '/start?returnTo=profile&reauthenticate=1'
                }
              >
                Confirmar con {provider === 'google' ? 'Google' : 'Facebook'}
              </a>
            ))}
          </div>
        </section>
      )}
      <div className="profile-grid">
        <section className="profile-panel">
          <h2>Datos personales</h2>
          <p className="profile-current-email">
            Correo actual:{' '}
            <strong>{profile.email || 'Sin correo agregado'}</strong>
          </p>
          {!profile.email && (
            <p>
              Ingresás con Facebook. Podés usar tu cuenta y consultar tus
              pedidos.
            </p>
          )}
          <form
            onSubmit={(e) =>
              update(e, '', { name: new FormData(e.currentTarget).get('name') })
            }
          >
            <label>
              Nombre
              <input
                key={profile.name}
                name="name"
                defaultValue={profile.name}
                autoComplete="name"
                minLength="2"
                maxLength="80"
                required
                disabled={busy}
              />
            </label>
            <button className="primary" disabled={busy}>
              Guardar datos
            </button>
          </form>
        </section>
        <section className="profile-panel">
          <h2>{profile.email ? 'Cambiar email' : 'Agregar email'}</h2>
          <p>
            {profile.canUpdateEmail
              ? 'Te enviaremos un enlace para confirmar que el correo es tuyo.'
              : 'La confirmación por correo todavía no está disponible. Podés seguir usando tu método de ingreso habitual.'}
          </p>
          <form
            onSubmit={(e) => {
              const data = Object.fromEntries(new FormData(e.currentTarget));
              update(e, '/email', data);
            }}
          >
            <label>
              Nuevo correo electrónico
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={busy || !profile.canUpdateEmail}
              />
            </label>
            {proof}
            <button
              className="primary"
              disabled={busy || !profile.canUpdateEmail}
            >
              Confirmar nuevo email
            </button>
          </form>
        </section>
        <section className="profile-panel">
          <h2>
            {profile.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
          </h2>
          {!profile.email ? (
            <p>
              Para crear una contraseña, primero agregá y confirmá un correo.
              Mientras tanto, ingresá con Facebook.
            </p>
          ) : (
            <>
              <p>
                Usá al menos 12 caracteres. Tus otras sesiones se cerrarán al
                guardar.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  if (data.password !== data.confirmPassword) {
                    setMessage('');
                    setError('Las contraseñas no coinciden.');
                    return;
                  }
                  delete data.confirmPassword;
                  update(e, '/password', data);
                }}
              >
                {proof}
                <label>
                  Nueva contraseña
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength="12"
                    maxLength="128"
                    required
                    disabled={busy}
                  />
                </label>
                <label>
                  Confirmar nueva contraseña
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength="12"
                    maxLength="128"
                    required
                    disabled={busy}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {profile.hasPassword
                    ? 'Cambiar contraseña'
                    : 'Crear contraseña'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
