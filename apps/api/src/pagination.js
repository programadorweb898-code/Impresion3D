export const pageSize = 20;

export function pageNumber(req, res) {
  const raw = req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,5}$/.test(raw)) {
    res.status(400).json({ message: 'Página inválida' });
    return null;
  }
  return Number(raw);
}

export const pageMetadata = (page, total) => ({
  page,
  total,
  pages: Math.max(1, Math.ceil(total / pageSize)),
});
