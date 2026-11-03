import { createMailer } from './mail.js';
import { hashPassword } from './passwords.js';
import { Router } from 'express';
import { z } from 'zod';
import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { User, SocialIdentity } from './models.js';
import { createVerificationRouter } from './email-verification.js';
import { facebookEmailPermission } from './facebook-email-permission.js';
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function createAccountServices(env = {}, transport = fetch) {
  const providers = {};
  for (const name of ['google', 'facebook']) {
    const prefix = name.toUpperCase();
    if (env[prefix + '_CLIENT_ID'] && env[prefix + '_CLIENT_SECRET'])
      providers[name] = {
        clientId: env[prefix + '_CLIENT_ID'],
        clientSecret: env[prefix + '_CLIENT_SECRET'],
      };
  }
  const sendMail = createMailer(env, transport);
  const linkEmail = (subject, text) =>
    sendMail
      ? ({ email, url }) => sendMail({ email, subject, text: text(url) })
      : null;
  return {
    sendEmailChange: linkEmail(
      'Confirmá tu nuevo email de impresión3D',
      (url) =>
        `Confirmá el nuevo correo de tu cuenta abriendo este enlace dentro de 30 minutos: ${url}\n\nSi no solicitaste este cambio, ignorá el mensaje.`,
    ),
    requireEmailVerification:
      env.REQUIRE_EMAIL_VERIFICATION === '1' ||
      (env.REQUIRE_EMAIL_VERIFICATION !== '0' && !!sendMail),
    sendVerification: linkEmail(
      'Confirmá tu cuenta de impresión3D',
      (url) =>
        `Confirmá tu correo y elegí tu contraseña abriendo este enlace dentro de 30 minutos: ${url}\n\nSi no solicitaste una cuenta, ignorá este mensaje.`,
    ),
    sendReset: linkEmail(
      'Recuperá tu cuenta de impresión3D',
      (url) =>
        `Recibimos una solicitud para cambiar tu contraseña. Abrí este enlace dentro de los próximos 30 minutos: ${url}\n\nSi no lo solicitaste, ignorá este correo. Tu contraseña no cambió.`,
    ),
    providers,
    fetch: transport,
    facebookVersion: env.FACEBOOK_GRAPH_VERSION || 'v23.0',
  };
}

export function createAccountAccess({
  webOrigin,
  services = createAccountServices(),
  authLimit,
  regenerate,
  save,
}) {
  const router = Router();
  router.use(
    createVerificationRouter({
      services,
      webOrigin,
      authLimit,
      regenerate,
      save,
    }),
  );
  const emailSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
  });
  const resetSchema = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: z.string().min(12).max(128),
  });
  router.get('/options', (_req, res) =>
    res.json({
      verification: !!services.sendVerification,
      google: !!services.providers.google,
      facebook: !!services.providers.facebook,
      recovery: !!services.sendReset,
    }),
  );
  router.post('/forgot-password', authLimit, async (req, res) => {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: 'Ingresá un correo válido.' });
    if (!services.sendReset)
      return res.status(503).json({
        message:
          'La recuperación por correo todavía no está disponible. Intentá más tarde.',
      });
    // Return the same response whether an address exists, has social access, or mail delivery fails.
    const token = randomBytes(32).toString('hex');
    const user = await User.findOneAndUpdate(
      {
        email: parsed.data.email,
        passwordHash: { $type: 'string' },
        $or: [
          { resetRequestedAt: { $lt: new Date(Date.now() - 60000) } },
          { resetRequestedAt: { $exists: false } },
        ],
      },
      {
        $set: {
          resetTokenHash: hash(token),
          resetExpiresAt: new Date(Date.now() + 30 * 60000),
          resetRequestedAt: new Date(),
        },
      },
    );
    if (user) {
      try {
        await services.sendReset({
          email: user.email,
          url: webOrigin + '/login#reset=' + token,
        });
      } catch {
        console.error(
          JSON.stringify({ event: 'password_reset_delivery_failed' }),
        );
      }
    }
    res.json({
      message:
        'Si el correo corresponde a una cuenta con contraseña, recibirás un enlace para recuperarla. Revisá también la carpeta de spam.',
    });
  });
  router.post('/reset-password', authLimit, async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        message:
          'Enlace inválido o contraseña demasiado corta. Usá al menos 12 caracteres.',
      });
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await User.findOneAndUpdate(
      {
        resetTokenHash: hash(parsed.data.token),
        resetExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordHash,
          emailVerifiedAt: new Date(),
          verificationRequired: false,
        },
        $unset: {
          resetTokenHash: 1,
          resetExpiresAt: 1,
          verificationTokenHash: 1,
          verificationExpiresAt: 1,
          pendingEmail: 1,
          emailChangeTokenHash: 1,
          emailChangeExpiresAt: 1,
        },
        $inc: { authVersion: 1 },
      },
    );
    if (!user)
      return res.status(400).json({
        message: 'El enlace venció o ya fue utilizado. Solicitá uno nuevo.',
      });
    await regenerate(req);
    await save(req);
    res.json({
      message:
        'Cambiaste tu contraseña. Iniciá sesión con tu nueva contraseña.',
    });
  });
  router.get('/:provider/start', authLimit, async (req, res) => {
    const provider = req.params.provider;
    const config =
      Object.hasOwn(services.providers, provider) &&
      services.providers[provider];
    if (!config) return res.redirect('/login?authError=unavailable');
    const state = randomBytes(32).toString('hex'),
      verifier = randomBytes(32).toString('base64url');
    req.session.oauth = {
      provider,
      state,
      verifier,
      expires: Date.now() + 10 * 60000,
      returnToProfile: req.query.returnTo === 'profile',
      expectedUserId:
        req.query.reauthenticate === '1' ? req.session.userId : undefined,
    };
    await save(req);
    const redirectUri = webOrigin + '/api/auth/' + provider + '/callback';
    const url = new URL(
      provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : `https://www.facebook.com/${services.facebookVersion}/dialog/oauth`,
    );
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope:
        provider === 'google' ? 'openid email profile' : 'email,public_profile',
      state,
    });
    if (provider === 'facebook' && req.query.rerequest === '1')
      url.searchParams.set('auth_type', 'rerequest');
    if (provider === 'google') {
      url.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    }
    res.redirect(url.href);
  });
  router.get('/:provider/callback', authLimit, async (req, res) => {
    const provider = req.params.provider,
      pending = req.session.oauth;
    delete req.session.oauth;
    await save(req);
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (
      !pending ||
      pending.provider !== provider ||
      pending.expires < Date.now() ||
      Buffer.byteLength(state) !== Buffer.byteLength(pending.state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(pending.state)) ||
      typeof req.query.code !== 'string' ||
      req.query.code.length > 4096 ||
      req.query.error
    )
      return res.redirect('/login?authError=cancelled');
    try {
      const config = services.providers[provider];
      if (!config) throw new Error('unavailable');
      const redirectUri = webOrigin + '/api/auth/' + provider + '/callback';
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        code: req.query.code,
        grant_type: 'authorization_code',
      });
      if (provider === 'google') body.set('code_verifier', pending.verifier);
      const exchange = await services.fetch(
        provider === 'google'
          ? 'https://oauth2.googleapis.com/token'
          : `https://graph.facebook.com/${services.facebookVersion}/oauth/access_token`,
        { method: 'POST', body, signal: AbortSignal.timeout(10000) },
      );
      if (!exchange.ok) throw new Error('exchange');
      const tokens = await exchange.json();
      if (typeof tokens.access_token !== 'string') throw new Error('token');
      const profileUrl = new URL(
        provider === 'google'
          ? 'https://openidconnect.googleapis.com/v1/userinfo'
          : `https://graph.facebook.com/${services.facebookVersion}/me`,
      );
      if (provider === 'facebook') {
        profileUrl.searchParams.set('fields', 'id,name,email');
        profileUrl.searchParams.set(
          'appsecret_proof',
          createHmac('sha256', config.clientSecret)
            .update(tokens.access_token)
            .digest('hex'),
        );
      }
      const response = await services.fetch(profileUrl.href, {
        headers: { Authorization: 'Bearer ' + tokens.access_token },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('profile');
      const profile = await response.json();
      const subject = provider === 'google' ? profile.sub : profile.id;
      if (typeof subject !== 'string' || !subject || subject.length > 255)
        throw new Error('subject');
      const identity = await SocialIdentity.findOne({ provider, subject });
      let user =
        identity &&
        (await User.findById(identity.userId).select('+authVersion'));
      if (!user) {
        if (pending.expectedUserId)
          return res.redirect('/login?authError=existing');
        const parsed = emailSchema.safeParse({ email: profile.email });
        if (
          !parsed.success ||
          (provider === 'google' && profile.email_verified !== true)
        ) {
          if (provider === 'facebook') {
            const permission = await facebookEmailPermission({
              transport: services.fetch,
              version: services.facebookVersion,
              clientSecret: config.clientSecret,
              accessToken: tokens.access_token,
            });
            console.info(
              JSON.stringify({
                event: 'facebook_email_unavailable',
                requestId: req.requestId,
                permission,
                emailField:
                  typeof profile.email === 'string' && profile.email.trim()
                    ? 'invalid_format'
                    : 'missing',
              }),
            );
            const error =
              permission === 'granted'
                ? 'facebook_email_account'
                : permission === 'unknown'
                  ? 'facebook_email'
                  : 'facebook_email_permission';
            return res.redirect('/login?authError=' + error);
          }
          return res.redirect('/login?authError=email');
        }
        // Never link by matching email: that could let a different identity take over an existing account.
        if (await User.exists({ email: parsed.data.email }))
          return res.redirect('/login?authError=existing');
        user = await User.create({
          name:
            typeof profile.name === 'string'
              ? profile.name.slice(0, 80)
              : 'Cliente',
          email: parsed.data.email,
          role: 'customer',
          ...(provider === 'google' ? { emailVerifiedAt: new Date() } : {}),
        });
        try {
          await SocialIdentity.create({ provider, subject, userId: user._id });
        } catch (error) {
          await User.deleteOne({ _id: user._id });
          throw error;
        }
      }
      if (pending.expectedUserId && pending.expectedUserId !== String(user._id))
        return res.redirect('/login?authError=existing');
      await regenerate(req);
      req.session.reauthenticatedAt = Date.now();
      req.session.userId = String(user._id);
      req.session.authVersion = user.authVersion || 0;
      await save(req);
      res.redirect(pending.returnToProfile ? '/perfil' : '/');
    } catch {
      res.redirect('/login?authError=provider');
    }
  });
  return router;
}
