import { publicProductProjection } from './public-product.js';
import { Product, Order } from './models.js';
import { relevancePipeline } from './relevance.js';
import { pageNumber, pageMetadata, pageSize as limit, catalogPageSize, orderPageSize } from './pagination.js';
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
        .select(publicProductProjection)
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
  const startsWith = req.query.startsWith;
  if (startsWith !== undefined) {
    if (typeof startsWith !== 'string' || startsWith.length > 80)
      return res.status(400).json({ message: 'Búsqueda inválida' });
    const escaped = startsWith
      .trim()
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped)
      filter.$or = [
        { name: { $regex: '^' + escaped, $options: 'i' } },
        { category: { $regex: '^' + escaped, $options: 'i' } },
        { categories: { $regex: '^' + escaped, $options: 'i' } },
      ];
  }
  const priceMin = req.query.priceMin;
  const priceMax = req.query.priceMax;
  if (priceMin !== undefined || priceMax !== undefined) {
    const min = priceMin === undefined ? undefined : Number(priceMin);
    const max = priceMax === undefined ? undefined : Number(priceMax);
    if (
      (min !== undefined && (!Number.isInteger(min) || min < 0)) ||
      (max !== undefined && (!Number.isInteger(max) || max < 0)) ||
      (min !== undefined && max !== undefined && min > max)
    )
      return res.status(400).json({ message: 'Rango de precio inválido' });
    filter.priceCents = {};
    if (min !== undefined) filter.priceCents.$gte = min;
    if (max !== undefined) filter.priceCents.$lte = max;
  }
  const sortKey = req.query.sort || 'relevance';
  const sort =
    sortKey === 'price-asc'
      ? { priceCents: 1, _id: 1 }
      : sortKey === 'price-desc'
        ? { priceCents: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };
  const products =
    sortKey === 'relevance'
      ? await Product.aggregate([
          ...relevancePipeline(filter, page, catalogPageSize),
          { $project: publicProductProjection },
        ])
      : await Product.find(filter)
          .sort(sort)
          .skip((page - 1) * catalogPageSize)
          .limit(catalogPageSize)
          .select(publicProductProjection)
          .lean();
  // Keep old open tabs compatible, with bounded responses.
  if (req.query.page === undefined) return res.json(products);
  const [total, primaryCategories, additionalCategories] = await Promise.all([
    Product.countDocuments(filter),
    Product.distinct('category', { active: true }),
    Product.distinct('categories', { active: true }),
  ]);
  res.json({
    products,
    ...pageMetadata(page, total, catalogPageSize),
    categories: [...new Set([...primaryCategories, ...additionalCategories])]
      .filter(Boolean)
      .sort(),
  });
}
export async function listOrders(req, res) {
  const page = pageNumber(req, res);
  if (!page) return;
  const filter = { userId: req.session.userId };
  const orders = await Order.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * orderPageSize)
    .limit(orderPageSize)
    .lean();
  if (req.query.page === undefined) return res.json(orders);
  const total = await Order.countDocuments(filter);
  res.json({
    orders,
    ...pageMetadata(page, total, orderPageSize),
  });
}
