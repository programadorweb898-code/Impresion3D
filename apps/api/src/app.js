import { hashPassword } from './passwords.js';
import { validate } from './http-validation.js';
import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { legalPageFromPath } from '@impresion3d/shared';
import { renderLegalDocument } from './legal-pages.js';
import { observePublicDocuments } from './public-document-requests.js';
import mongoose from 'mongoose';
import helmet from 'helmet';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { loginSchema, registerSchema, orderSchema } from '@impresion3d/shared';
import { User, Product } from './models.js';
import { listProducts, listOrders } from './list-routes.js';
import { createAdminRouter } from './admin.js';
import { submitCatalogOrder } from './checkout.js';
import { sendVerification } from './email-verification.js';
import {
  createAccountAccess,
  createAccountServices,
} from './account-access.js';
import { createProfileRouter } from './profile.js';
export function createApp({
  sessionStore,
  sessionSecret,
  webOrigin,
  production = false,
  trustProxy = false,
  staticDirectory,
  imageStorage,
  accountServices = createAccountServices(),
  notifyOrder,
  buildCommit,
}) {
  const app = express();
  app.use(observePublicDocuments());
  app.use('/api', (req, res, next) => {
    req.requestId = randomUUID();
    res.set('x-request-id', req.requestId);
    const started = Date.now();
    res.on('finish', () => {
      if (res.statusCode >= 500)
        console.error(
          JSON.stringify({
            event: 'http_request_failed',
            requestId: req.requestId,
            method: req.method,
            route: req.route?.path || '/api',
            status: res.statusCode,
            durationMs: Date.now() - started,
          }),
        );
    });
    next();
  });
  if (trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
        },
      },
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Hiciste varios intentos seguidos. Esperá unos minutos y volvé a intentarlo.' },
    }),
  );
  app.use(
    session({
      name: 'impresion3d.sid',
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.get('/api/ready', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'unavailable' });
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/csrf', (req, res) => {
    req.session.csrf ||= randomBytes(32).toString('hex');
    res.json({ token: req.session.csrf });
  });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('origin') !== webOrigin)
      return res.status(403).json({ message: 'No pudimos verificar la solicitud. Recargá la página y volvé a intentarlo.' });
    const supplied = req.get('x-csrf-token') || '';
    const expected = req.session.csrf || '';
    if (
      !expected ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      return res
        .status(403)
        .json({ message: 'Sesión de formulario inválida. Recargá la página.' });
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
      message: { message: 'Hiciste varios intentos seguidos. Esperá unos minutos y volvé a intentarlo.' },
  });
  const account = (u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role || 'customer',
  });
  const regenerate = (req) =>
    new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
  const save = (req) =>
    new Promise((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
  const authenticated = async (req, res, next) => {
    if (!req.session.userId)
      return res.status(401).json({ message: 'Iniciá sesión para continuar' });
    const user = await User.findById(req.session.userId).select('+authVersion');
    if (!user || (req.session.authVersion || 0) !== (user.authVersion || 0))
      return res.status(401).json({ message: 'Tu sesión venció. Volvé a iniciar sesión.' });
    req.user = user;
    next();
  };
  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      ...(buildCommit && /^[a-f0-9]{40}$/.test(buildCommit)
        ? { commit: buildCommit }
        : {}),
    }),
  );
  app.get('/api/products', listProducts);
  app.get('/api/products/:id', async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id))
      return res.status(404).json({ message: 'Producto no disponible.' });
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, active: true },
      { $inc: { viewsCount: 1 } },
      { new: true, timestamps: false },
    )
      .select('-__v')
      .lean();
    if (!product)
      return res.status(404).json({ message: 'Producto no disponible.' });
    res.json(product);
  });
  app.post(
    '/api/auth/register',
    authLimit,
    validate(registerSchema),
    async (req, res) => {
      const { name, email, password } = req.body;
      const verificationRequired =
        accountServices.requireEmailVerification ??
        !!accountServices.sendVerification;
      if (verificationRequired && !accountServices.sendVerification)
        return res.status(503).json({
          message:
            'El registro requiere confirmar tu correo y el envío todavía no está disponible. Intentá más tarde.',
        });
      const passwordHash = await hashPassword(password);
      const user = await User.create({
        name,
        email,
        passwordHash,
        verificationRequired,
      });
      if (verificationRequired) {
        await sendVerification(user._id, accountServices, webOrigin);
        return res.status(202).json({
          verificationRequired: true,
          message:
            'Revisá tu correo para confirmar la cuenta y elegir tu contraseña. Si no llega, usá Reenviar confirmación.',
        });
      }
      await regenerate(req);
      req.session.userId = String(user._id);
      req.session.authVersion = user.authVersion || 0;
      await save(req);
      res.status(201).json(account(user));
    },
  );
  // A dummy hash makes unknown emails perform the same password verification work.
  const dummyHash = hashPassword(randomBytes(32));
  app.post(
    '/api/auth/login',
    authLimit,
    validate(loginSchema),
    async (req, res) => {
      const user = await User.findOne({ email: req.body.email }).select(
        '+passwordHash +authVersion',
      );
      const valid = await argon2.verify(
        user?.passwordHash || (await dummyHash),
        req.body.password,
      );
      if (!user || !user.passwordHash || !valid)
        return res
          .status(401)
          .json({ message: 'Correo o contraseña incorrectos' });
      if (user.verificationRequired)
        return res.status(403).json({
          code: 'EMAIL_UNVERIFIED',
          message:
            'Confirmá tu correo antes de ingresar. Podés reenviar la confirmación.',
        });
      await regenerate(req);
      req.session.userId = String(user._id);
      req.session.authVersion = user.authVersion || 0;
      await save(req);
      res.json(account(user));
    },
  );
  app.use(
    '/api/auth',
    createAccountAccess({
      webOrigin,
      services: accountServices,
      authLimit,
      regenerate,
      save,
    }),
  );
  app.use(
    '/api/profile',
    authenticated,
    createProfileRouter({
      services: accountServices,
      webOrigin,
      authLimit,
      save,
      regenerate,
    }),
  );
  app.get('/api/auth/me', authenticated, async (req, res) => {
    const u = await User.findById(req.session.userId);
    if (!u) return res.status(401).json({ message: 'Tu sesión venció. Volvé a iniciar sesión.' });
    res.json(account(u));
  });
  app.post('/api/auth/logout', (req, res, next) =>
    req.session.destroy((e) => {
      if (e) return next(e);
      res.clearCookie('impresion3d.sid', {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
      });
      res.sendStatus(204);
    }),
  );
  app.get('/api/orders', authenticated, listOrders);
  app.post(
    '/api/orders',
    authenticated,
    validate(orderSchema),
    submitCatalogOrder,
  );
  app.use(
    '/api/admin',
    authenticated,
    createAdminRouter({
      imageStorage,
      accountServices,
      notifyOrder,
      buildCommit,
    }),
  );
  app.use('/api', (_req, res) =>
    res.status(404).json({ message: 'Ruta no encontrada' }),
  );
  if (staticDirectory) {
    app.use(
      '/assets',
      express.static(path.join(staticDirectory, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
    );
    app.use(express.static(staticDirectory, { maxAge: 0 }));
    app.get('/{*path}', async (req, res, next) => {
      if (path.extname(req.path)) return res.status(404).end();
      res.set('Cache-Control', 'no-cache');
      const legalKey = legalPageFromPath(req.path);
      if (legalKey) {
        const template = await readFile(
          path.join(staticDirectory, 'index.html'),
          'utf8',
        );
        return res.type('html').send(renderLegalDocument(template, legalKey));
      }
      res.sendFile(path.join(staticDirectory, 'index.html'));
    });
  }
  app.use((err, req, res, _next) => {
    if (err.publicModelError)
      return res.status(400).json({ message: err.message });
    if (err.name === 'MulterError' && req.productModelUpload)
      return res.status(400).json({
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'El modelo supera el límite de 10 MiB.'
            : 'Subí un solo modelo, sin campos adicionales.',
      });
    if (err.name === 'MulterError')
      return res.status(400).json({
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'La foto supera el límite de 5 MiB'
            : 'Subí una sola foto, sin campos adicionales',
      });
    if (err.status === 400 && err.message === 'Usá una foto JPG, PNG o WebP')
      return res.status(400).json({ message: err.message });
    if (err.status === 400 && err.message.startsWith('La foto no es válida'))
      return res.status(400).json({ message: err.message });
    if (err.status === 404) return res.status(404).end();
    if (
      err.code === 11000 &&
      req.path === '/api/auth/register' &&
      (err.keyPattern?.email || err.keyValue?.email)
    )
      return res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Ese correo ya está registrado, ingresé otro por favor',
      });
    if (err.code === 11000)
      return res
        .status(409)
        .json({ message: 'No se pudo crear la cuenta con esos datos' });
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ message: 'No pudimos leer los datos enviados. Recargá la página y volvé a intentarlo.' });
    if (err.status === 413)
      return res.status(413).json({ message: 'Solicitud demasiado grande' });
    console.error(
      JSON.stringify({
        event: 'application_error',
        requestId: req.requestId,
        type: err.name || 'Error',
      }),
    );
    res.status(500).json({ message: 'No se pudo completar la operación' });
  });
  return app;
}

