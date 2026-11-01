import { Product, Order } from './models.js';
const limit = 20;
function pageNumber(req, res) {
  const raw = req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,5}$/.test(raw)) {
    res.status(400).json({ message: 'Página inválida' });
    return null;
  }
  return Number(raw);
}
export async function listProducts(req, res) {
  const page = pageNumber(req, res);
  if (!page) return;
  const filter = { active: true };
  if (req.query.ids !== undefined) {
    if (typeof req.query.ids !== 'string')
      return res.status(400).json({ message: 'Productos inválidos' });
    const ids = req.query.ids.split(',');
    if (ids.length > 20 || ids.some((id) => !/^[a-f0-9]{24}$/i.test(id)))
      return res.status(400).json({ message: 'Productos inválidos' });
    return res.json(
      await Product.find({ ...filter, _id: { $in: ids } })
        .select('-__v')
        .limit(limit)
        .lean(),
    );
  }
  if (req.query.category !== undefined) {
    if (
      typeof req.query.category !== 'string' ||
      req.query.category.length > 60
    )
      return res.status(400).json({ message: 'Categoría inválida' });
    filter.category = req.query.category;
  }
  const products = await Product.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-__v')
    .lean();
  // Keep old open tabs compatible, with bounded responses.
  if (req.query.page === undefined) return res.json(products);
  const [total, categories] = await Promise.all([
    Product.countDocuments(filter),
    Product.distinct('category', { active: true }),
  ]);
  res.json({
    products,
    page,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    categories: categories.filter(Boolean).sort(),
  });
}
export async function listOrders(req, res) {
  const page = pageNumber(req, res);
  if (!page) return;
  const filter = { userId: req.session.userId };
  const orders = await Order.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  if (req.query.page === undefined) return res.json(orders);
  const total = await Order.countDocuments(filter);
  res.json({
    orders,
    page,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}
