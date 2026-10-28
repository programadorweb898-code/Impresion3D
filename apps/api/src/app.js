import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { loginSchema, registerSchema, orderSchema } from '@impresion3d/shared';
import { User, Product, Order } from './models.js';
import { adminRouter } from './admin.js';
export function createApp({
  sessionStore,
  sessionSecret,
  webOrigin,
  production = false,
  trustProxy = false,
}) {
  const app = express();
  if (trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
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
  app.get('/api/csrf', (req, res) => {
    req.session.csrf ||= randomBytes(32).toString('hex');
    res.json({ token: req.session.csrf });
  });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('origin') !== webOrigin)
      return res.status(403).json({ message: 'Origen no permitido' });
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
  });
  const validate = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message });
    req.body = parsed.data;
    next();
  };
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
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ message: 'Sesión inválida' });
    req.user = user;
    next();
  };
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/products', async (_req, res) =>
    res.json(await Product.find({ active: true }).select('-__v').lean()),
  );
  app.post(
    '/api/auth/register',
    authLimit,
    validate(registerSchema),
    async (req, res) => {
      const { name, email, password } = req.body;
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const user = await User.create({ name, email, passwordHash });
      await regenerate(req);
      req.session.userId = String(user._id);
      await save(req);
      res.status(201).json(account(user));
    },
  );
  // A dummy hash makes unknown emails perform the same password verification work.
  const dummyHash = argon2.hash(randomBytes(32), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  app.post(
    '/api/auth/login',
    authLimit,
    validate(loginSchema),
    async (req, res) => {
      const user = await User.findOne({ email: req.body.email }).select(
        '+passwordHash',
      );
      const valid = await argon2.verify(
        user?.passwordHash || (await dummyHash),
        req.body.password,
      );
      if (!user || !valid)
        return res
          .status(401)
          .json({ message: 'Correo o contraseña incorrectos' });
      await regenerate(req);
      req.session.userId = String(user._id);
      await save(req);
      res.json(account(user));
    },
  );
  app.get('/api/auth/me', authenticated, async (req, res) => {
    const u = await User.findById(req.session.userId);
    if (!u) return res.status(401).json({ message: 'Sesión inválida' });
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
  app.get('/api/orders', authenticated, async (req, res) =>
    res.json(
      await Order.find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .lean(),
    ),
  );
  app.post(
    '/api/orders',
    authenticated,
    validate(orderSchema),
    async (req, res) => {
      const product = await Product.findOne({
        _id: req.body.productId,
        active: true,
      });
      if (!product)
        return res.status(404).json({ message: 'Producto no disponible' });
      const { quantity, notes } = req.body;
      const order = await Order.create({
        userId: req.session.userId,
        items: [
          {
            productId: product._id,
            name: product.name,
            unitPriceCents: product.priceCents,
            quantity,
            dimensions: product.dimensions,
          },
        ],
        totalCents: product.priceCents * quantity,
        currency: product.currency,
        notes,
        history: [{ status: 'recibido', at: new Date() }],
      });
      res.status(201).json(order);
    },
  );
  app.use('/api/admin', authenticated, adminRouter);
  app.use('/api', (_req, res) =>
    res.status(404).json({ message: 'Ruta no encontrada' }),
  );
  app.use((err, _req, res, _next) => {
    if (err.code === 11000)
      return res
        .status(409)
        .json({ message: 'No se pudo crear la cuenta con esos datos' });
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ message: 'JSON inválido' });
    if (err.status === 413)
      return res.status(413).json({ message: 'Solicitud demasiado grande' });
    console.error(err.name);
    res.status(500).json({ message: 'No se pudo completar la operación' });
  });
  return app;
}
