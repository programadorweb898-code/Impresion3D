import { Router } from 'express';
import { Product, Order } from './models.js';
import {
  productSchema,
  orderUpdateSchema,
  statusTransitions,
} from '@impresion3d/shared';
export const adminRouter = Router();
adminRouter.use((req, res, next) =>
  req.user.role === 'admin'
    ? next()
    : res.status(403).json({ message: 'Acceso exclusivo para administración' }),
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
adminRouter.put('/products/:id', validate(productSchema), async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!product)
    return res.status(404).json({ message: 'Producto no encontrado' });
  res.json(product);
});
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
      return res.status(400).json({ message: 'Cambio de estado no permitido' });
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
        $push: { history: { status, at: new Date(), estimatedReadyAt: date } },
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
