import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { imageUpload, normalizeImage } from './images.js';
import { rateLimit } from 'express-rate-limit';
import { Product, Order } from './models.js';
import {
  productSchema,
  orderUpdateSchema,
  statusTransitions,
} from '@impresion3d/shared';
export function createAdminRouter({ imageStorage } = {}) {
  const adminRouter = Router();
  adminRouter.use((req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : res
          .status(403)
          .json({ message: 'Acceso exclusivo para administración' }),
  );
  const validate = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message });
    req.body = parsed.data;
    next();
  };
  adminRouter.param('id', (req, res, next, id) =>
    /^[a-f0-9]{24}$/i.test(id)
      ? next()
      : res.status(400).json({ message: 'Identificador inválido' }),
  );
  adminRouter.get('/products', async (_req, res) =>
    res.json(await Product.find().sort({ createdAt: -1 }).lean()),
  );
  adminRouter.post('/products', validate(productSchema), async (req, res) =>
    res.status(201).json(await Product.create(req.body)),
  );
  adminRouter.put(
    '/products/:id',
    validate(productSchema),
    async (req, res) => {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true },
      );
      if (!product)
        return res.status(404).json({ message: 'Producto no encontrado' });
      res.json(product);
    },
  );
  adminRouter.get('/orders', async (req, res) => {
    const raw = typeof req.query.page === 'string' ? req.query.page : '1';
    if (!/^[1-9][0-9]{0,5}$/.test(raw))
      return res.status(400).json({ message: 'Página inválida' });
    const page = Number(raw);
    const limit = 20;
    const [orders, total] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      Order.countDocuments(),
    ]);
    res.json({
      orders,
      page,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  });
  adminRouter.patch(
    '/orders/:id',
    validate(orderUpdateSchema),
    async (req, res) => {
      const current = await Order.findById(req.params.id);
      if (!current)
        return res.status(404).json({ message: 'Pedido no encontrado' });
      if (current.__v !== req.body.version)
        return res.status(409).json({
          message: 'El pedido cambió. Actualizá la lista antes de guardar.',
        });
      const { status, estimatedReadyAt } = req.body;
      const sameStatus = status === current.status;
      if (!sameStatus && !statusTransitions[current.status].includes(status))
        return res
          .status(400)
          .json({ message: 'Cambio de estado no permitido' });
      if (sameStatus && !statusTransitions[current.status].length)
        return res.status(400).json({ message: 'El pedido ya está cerrado' });
      const date = estimatedReadyAt ? new Date(estimatedReadyAt) : null;
      const sameDate =
        (current.estimatedReadyAt?.toISOString() || null) === estimatedReadyAt;
      if (sameStatus && sameDate) return res.json(current);
      if (date && !sameDate && date.getTime() <= Date.now())
        return res
          .status(400)
          .json({ message: 'La entrega estimada debe ser futura' });
      const order = await Order.findOneAndUpdate(
        { _id: current._id, __v: req.body.version },
        {
          $set: { status, estimatedReadyAt: date },
          $inc: { __v: 1 },
          $push: {
            history: { status, at: new Date(), estimatedReadyAt: date },
          },
        },
        { new: true, runValidators: true },
      );
      if (!order)
        return res.status(409).json({
          message: 'El pedido cambió. Actualizá la lista antes de guardar.',
        });
      res.json(order);
    },
  );

  const uploadLimit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  adminRouter.post(
    '/products/:id/image',
    uploadLimit,
    (req, res, next) => {
      const requestId = randomUUID();
      req.photoPhase = 'received';
      res.set('x-request-id', requestId);
      console.info(
        JSON.stringify({ event: 'photo_upload_started', requestId }),
      );
      res.on('finish', () =>
        console.info(
          JSON.stringify({
            event: 'photo_upload_finished',
            requestId,
            phase: req.photoPhase,
            status: res.statusCode,
          }),
        ),
      );
      req.on('aborted', () =>
        console.warn(
          JSON.stringify({
            event: 'photo_upload_aborted',
            requestId,
            phase: req.photoPhase,
          }),
        ),
      );
      next();
    },
    (req, res, next) => {
      if (!imageStorage)
        return res.status(503).json({
          message:
            'La carga de fotos todavía no está habilitada. Configurá Cloudinary.',
        });
      next();
    },
    async (req, res, next) => {
      if (!(await Product.exists({ _id: req.params.id })))
        return res.status(404).json({ message: 'Producto no encontrado' });
      next();
    },
    imageUpload,
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ message: 'Seleccioná una foto' });
      req.photoPhase = 'processing';
      const normalized = await normalizeImage(req.file.buffer);
      let image;
      try {
        req.photoPhase = 'cloudinary';
        image = await imageStorage.upload(normalized.buffer);
      } catch (error) {
        const providerStatus = Number(error?.http_code) || null;
        console.warn(
          JSON.stringify({
            event: 'photo_storage_failed',
            requestId: res.get('x-request-id'),
            providerStatus,
          }),
        );
        const message = [401, 403].includes(providerStatus)
          ? 'Cloudinary rechazó las credenciales o los permisos. Revisá sus variables en Render.'
          : 'No se pudo guardar la foto en Cloudinary. Intentá nuevamente.';
        return res.status(502).json({ message });
      }
      let previous;
      req.photoPhase = 'database';
      try {
        previous = await Product.findOneAndUpdate(
          { _id: req.params.id },
          { $set: { image } },
          { new: false, runValidators: true },
        );
      } catch {
        // A failed write can have an ambiguous result. Retain the uploaded image rather
        // than risk removing an asset already referenced by the product.
        return res.status(503).json({
          message:
            'No se pudo confirmar el cambio. Actualizá la lista antes de reintentar.',
        });
      }
      if (!previous) {
        await imageStorage.remove(image.publicId).catch(() => {});
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      req.photoPhase = 'cleanup';
      if (previous.image?.publicId)
        await imageStorage
          .remove(previous.image.publicId)
          .catch(() => console.warn('No se pudo limpiar una foto reemplazada'));
      req.photoPhase = 'complete';
      res.json({ image });
    },
  );
  return adminRouter;
}
