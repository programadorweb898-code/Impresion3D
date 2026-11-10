import { rateLimitMessage } from './rate-limit-message.js';
import { pageNumber, pageMetadata, pageSize as limit } from './pagination.js';
import { validate } from './http-validation.js';
import { Router } from 'express';
import { addModelRoutes } from './model-routes.js';
import { randomUUID } from 'node:crypto';
import { cloudinaryFailure } from './cloudinary-errors.js';
import { imageUpload, normalizeImage } from './images.js';
import { rateLimit } from 'express-rate-limit';
import { Product, Order } from './models.js';
import {
  productSchema,
  productUpdateSchema,
  orderUpdateSchema,
  statusTransitions,
} from '@impresion3d/shared';
export function createAdminRouter({
  imageStorage,
  accountServices = {},
  notifyOrder,
  buildCommit,
} = {}) {
  const adminRouter = Router();
  adminRouter.use((req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : res
          .status(403)
          .json({ message: 'Acceso exclusivo para administración' }),
  );
  adminRouter.param('id', (req, res, next, id) =>
    /^[a-f0-9]{24}$/i.test(id)
      ? next()
      : res.status(400).json({ message: 'Identificador inválido' }),
  );
  adminRouter.get('/operations', async (_req, res) => {
    const failedNotifications = await Order.countDocuments({
      'notification.state': 'failed',
    });
    res.json({
      commit: buildCommit || null,
      integrations: {
        images: !!imageStorage,
        models: !!imageStorage?.uploadModel,
        recovery: !!accountServices.sendReset,
        verification: !!accountServices.sendVerification,
        google: !!accountServices.providers?.google,
        facebook: !!accountServices.providers?.facebook,
        orderNotifications: !!notifyOrder,
      },
      failedNotifications,
    });
  });
  adminRouter.get('/products', async (req, res) => {
    const page = pageNumber(req, res);
    if (!page) return;
    const products = await Product.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    if (req.query.page === undefined) return res.json(products);
    const total = await Product.countDocuments();
    res.json({
      products,
      ...pageMetadata(page, total),
    });
  });
  adminRouter.post('/products', validate(productSchema), async (req, res) =>
    res.status(201).json(await Product.create(req.body)),
  );
  adminRouter.put(
    '/products/:id',
    validate(productUpdateSchema),
    async (req, res) => {
      const { version, ...fields } = req.body;
      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, __v: version },
        { $set: fields, $inc: { __v: 1 } },
        { new: true, runValidators: true },
      );
      if (!product) {
        if (!(await Product.exists({ _id: req.params.id })))
          return res.status(404).json({ message: 'Producto no encontrado' });
        return res.status(409).json({
          message: 'El producto cambió. Actualizá la lista y volvé a editarlo.',
        });
      }
      res.json(product);
    },
  );
  adminRouter.delete('/products/:id', async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    if (product.image?.publicId)
      await imageStorage.remove(product.image.publicId).catch(() => {});
    if (product.gallery?.angle?.publicId)
      await imageStorage.remove(product.gallery.angle.publicId).catch(() => {});
    if (product.gallery?.context?.publicId)
      await imageStorage
        .remove(product.gallery.context.publicId)
        .catch(() => {});
    res.json({ message: 'Producto eliminado del catálogo' });
  });
  adminRouter.get('/orders', async (req, res) => {
    const page = pageNumber(req, res);
    if (!page) return;
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
      ...pageMetadata(page, total),
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
    message: rateLimitMessage,
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
        const failure = cloudinaryFailure(error);
        console.warn(
          JSON.stringify({
            event: 'photo_storage_failed',
            requestId: res.get('x-request-id'),
            providerStatus,
            providerReason: failure.reason,
          }),
        );
        const message = failure.message;
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

  adminRouter.post(
    '/products/:id/gallery/:slot',
    uploadLimit,
    (req, res, next) => {
      if (!['angle', 'context'].includes(req.params.slot))
        return res.status(400).json({ message: 'Elegí Otro ángulo o En uso.' });
      if (!imageStorage)
        return res
          .status(503)
          .json({
            message: 'La carga de fotos no está disponible. Intentá más tarde.',
          });
      next();
    },
    imageUpload,
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ message: 'Seleccioná una foto.' });
      const current = await Product.findById(req.params.id);
      if (!current)
        return res.status(404).json({ message: 'Producto no encontrado.' });
      const normalized = await normalizeImage(req.file.buffer);
      let image;
      try {
        image = await imageStorage.upload(normalized.buffer);
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: 'gallery_upload_failed',
            reason: cloudinaryFailure(error).reason,
          }),
        );
        return res
          .status(502)
          .json({ message: 'No pudimos guardar la foto. Intentá más tarde.' });
      }
      let product;
      try {
        product = await Product.findOneAndUpdate(
          { _id: current._id, __v: current.__v },
          { $set: { ['gallery.' + req.params.slot]: image }, $inc: { __v: 1 } },
          { new: true, runValidators: true },
        );
      } catch {
        return res
          .status(503)
          .json({
            message:
              'No pudimos confirmar el cambio. Actualizá la lista antes de reintentar.',
          });
      }
      if (!product) {
        await imageStorage.remove(image.publicId).catch(() => {});
        return res
          .status(409)
          .json({
            message:
              'El producto cambió. Actualizá la lista y volvé a intentarlo.',
          });
      }
      const previous = current.gallery?.[req.params.slot];
      if (previous?.publicId)
        await imageStorage.remove(previous.publicId).catch(() => {});
      res.json({ gallery: product.gallery });
    },
  );

  addModelRoutes(adminRouter, imageStorage);
  return adminRouter;
}
