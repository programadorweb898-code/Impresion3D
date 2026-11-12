import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PhotoQuote } from './models.js';
import { normalizeImage } from './images.js';
import { pageNumber, pageMetadata } from './pagination.js';

const imageLimit = 5 * 1024 * 1024;
const invalid = (message) =>
  Object.assign(new Error(message), { status: 400, photoQuoteError: true });
const contactSchema = z.discriminatedUnion('method', [
  z.strictObject({
    method: z.literal('email'),
    value: z.email().max(254),
  }),
  z.strictObject({
    method: z.literal('whatsapp'),
    value: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Ingresá WhatsApp con código de país, por ejemplo +54911...'),
  }),
]);
const metadataSchema = z.strictObject({
  requestId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
  approximateSize: z.string().trim().max(120),
  details: z.string().trim().max(1500),
  contact: contactSchema,
  contactConsent: z.literal(true),
});
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: imageLimit, files: 1, fields: 1, parts: 2, fieldSize: 8192 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      return cb(invalid('La imagen debe ser JPG, PNG o WebP.'));
    cb(null, true);
  },
}).single('image');

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'photoQuoteImages',
  });
const publicQuote = (row) => ({
  _id: row._id,
  filename: row.filename,
  quantity: row.quantity,
  approximateSize: row.approximateSize,
  details: row.details,
  contact: row.contact,
  status: row.status,
  priceCents: row.priceCents,
  response: row.response,
  createdAt: row.createdAt,
  __v: row.__v,
  ...(row.userId?.name
    ? { customer: { name: row.userId.name, email: row.userId.email } }
    : {}),
});
const statusSchema = z.strictObject({
  status: z.enum(['recibido', 'en_revision', 'presupuestado', 'cerrado']),
  priceCents: z.number().int().min(0).max(1000000000).nullable(),
  response: z.string().trim().max(2000),
  version: z.number().int().min(0),
});
const paginate = async (req, res, filter, populate = false) => {
  const page = pageNumber(req, res);
  if (!page) return;
  let query = PhotoQuote.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * 20)
    .limit(20);
  if (populate) query = query.populate('userId', 'name email');
  const [rows, total] = await Promise.all([
    query.lean(),
    PhotoQuote.countDocuments(filter),
  ]);
  res.json({
    requests: rows.map(publicQuote),
    ...pageMetadata(page, total),
  });
};

export function photoQuotesRouter(authenticated) {
  const router = Router();
  router.use(authenticated);
  router.get('/', (req, res) => paginate(req, res, { userId: req.user._id }));
  router.post(
    '/',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 5,
      keyGenerator: (req) => String(req.user._id),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    uploadImage,
    async (req, res) => {
      if (!req.file?.buffer?.length)
        throw invalid('Seleccioná una imagen del producto.');
      let raw;
      try {
        raw = JSON.parse(req.body.metadata);
      } catch {
        throw invalid('Completá los datos de tu solicitud.');
      }
      const parsed = metadataSchema.safeParse(raw);
      if (!parsed.success)
        throw invalid(parsed.error.issues[0].message);
      const data = parsed.data;
      const { buffer } = await normalizeImage(req.file.buffer);
      const hash = createHash('sha256')
        .update(buffer)
        .update(JSON.stringify({
          quantity: data.quantity,
          approximateSize: data.approximateSize,
          details: data.details,
          contact: data.contact,
        }))
        .digest('hex');
      const existing = await PhotoQuote.findOne({
        userId: req.user._id,
        requestId: data.requestId,
      }).select('+requestHash');
      if (existing) {
        if (existing.requestHash !== hash)
          return res.status(409).json({ message: 'Esta solicitud ya tiene otros datos. Actualizá la página.' });
        return res.json(publicQuote(existing));
      }
      if ((await PhotoQuote.countDocuments({
        userId: req.user._id,
        status: { $ne: 'cerrado' },
      })) >= 20)
        return res.status(409).json({
          message: 'Tenés 20 solicitudes abiertas. Esperá la revisión antes de enviar otra.',
        });
      const filename = req.file.originalname
        .replace(/[\x00-\x1f\x7f/\\]/g, '_')
        .slice(0, 160);
      const upload = bucket().openUploadStream('referencia.webp', {
        metadata: { userId: req.user._id, contentType: 'image/webp' },
      });
      await pipeline(Readable.from([buffer]), upload);
      let row;
      try {
        row = await PhotoQuote.create({
          ...data,
          filename,
          fileId: upload.id,
          requestHash: hash,
          userId: req.user._id,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        await bucket().delete(upload.id).catch(() => {});
        row = await PhotoQuote.findOne({
          userId: req.user._id,
          requestId: data.requestId,
        }).select('+requestHash');
        if (!row || row.requestHash !== hash)
          return res.status(409).json({ message: 'Conflicto al guardar la solicitud. Recargá tus solicitudes.' });
      }
      res.status(201).json(publicQuote(row));
    },
  );
  router.get('/:id/image', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    const row = await PhotoQuote.findOne({
      _id: req.params.id,
      ...(req.user.role === 'admin' ? {} : { userId: req.user._id }),
    }).lean();
    if (!row) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    if (!(await bucket().find({ _id: row.fileId }).limit(1).hasNext()))
      return res.status(404).json({ message: 'Imagen no disponible.' });
    res.set({
      'Content-Type': 'image/webp',
      'Content-Disposition': 'inline; filename="referencia.webp"',
      'Cache-Control': 'private, no-store',
    });
    await pipeline(bucket().openDownloadStream(row.fileId), res);
  });
  return router;
}
export function adminPhotoQuotesRouter() {
  const router = Router();
  router.use((req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : res.status(403).json({ message: 'Acceso reservado a administración.' }),
  );
  router.get('/', (req, res) => paginate(req, res, {}, true));
  router.patch('/:id', async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!mongoose.isValidObjectId(req.params.id) || !parsed.success)
      throw invalid('Revisá el estado y los datos del presupuesto.');
    const { version, ...values } = parsed.data;
    if (values.status === 'presupuestado' && !(values.priceCents > 0))
      throw invalid('Ingresá un precio para marcar como presupuestada.');
    const row = await PhotoQuote.findOneAndUpdate(
      { _id: req.params.id, __v: version },
      { $set: values, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    ).populate('userId', 'name email').lean();
    if (!row)
      return res.status(409).json({ message: 'La solicitud cambió. Actualizá la lista.' });
    res.json(publicQuote(row));
  });
  return router;
}
