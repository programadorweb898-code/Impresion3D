import { createUploadCapacity } from './upload-capacity.js';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';
import { z } from 'zod';
import { publicSlice } from './slicing.js';
import { DesignRequest, SlicingJob } from './models.js';
import { pageNumber, pageMetadata } from './pagination.js';
const limit = 50 * 1024 * 1024;
const metadataSchema = z
  .object({
    requestId: z.uuid(),
    quantity: z.number().int().min(1).max(1000),
    scale: z.number().min(0.001).max(1000),
    dimensions: z
      .object({
        width: z.number().positive().max(1000000),
        height: z.number().positive().max(1000000),
        depth: z.number().positive().max(1000000),
      })
      .strict(),
    colorStatus: z.enum(['complete', 'missing', 'unknown']),
    acceptedMissingColor: z.boolean(),
    usage: z.string().trim().max(1000).default(''),
  })
  .strict();
const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'designOriginals',
  });
const invalid = (message) =>
  Object.assign(new Error(message), { status: 400, publicModelError: true });
async function validateOriginal(file) {
  if (!file?.buffer?.length) throw invalid('Elegí el archivo de tu modelo.');
  const format = file.originalname.split('.').pop().toLowerCase();
  const b = file.buffer;
  if (format === '3mf') {
    await new Promise((resolve, reject) =>
      yauzl.fromBuffer(b, { lazyEntries: true }, (error, zip) => {
        if (error) return reject(invalid('El archivo 3MF no es válido.'));
        let count = 0,
          total = 0,
          model = false;
        const fail = () => {
          zip.close();
          reject(
            invalid(
              'El 3MF contiene recursos inválidos o es demasiado complejo.',
            ),
          );
        };
        zip.on('error', fail);
        zip.on('entry', (e) => {
          total += e.uncompressedSize;
          if (
            ++count > 2048 ||
            total > 256 * 1024 * 1024 ||
            e.fileName.includes('..') ||
            e.fileName.startsWith('/') ||
            e.generalPurposeBitFlag & 1
          )
            return fail();
          if (/\.model$/i.test(e.fileName)) model = true;
          zip.readEntry();
        });
        zip.on('end', () =>
          model ? resolve() : reject(invalid('El 3MF no contiene geometría.')),
        );
        zip.readEntry();
      }),
    );
  } else if (format === 'glb') {
    if (
      b.length < 20 ||
      b.toString('ascii', 0, 4) !== 'glTF' ||
      b.readUInt32LE(4) !== 2 ||
      b.readUInt32LE(8) !== b.length
    )
      throw invalid('El archivo GLB no es válido.');
  } else if (format === 'stl') {
    if (
      !(b.length >= 84 && 84 + 50 * b.readUInt32LE(80) === b.length) &&
      !/^\s*solid\b[\s\S]*\bendsolid\b/i.test(b.toString('utf8'))
    )
      throw invalid('El archivo STL no es válido.');
  } else throw invalid('Usá un archivo 3MF, STL o GLB.');
  return format;
}
const publicRequest = (r) => {
  const {
    _id,
    filename,
    format,
    quantity,
    scale,
    dimensions,
    colorStatus,
    acceptedMissingColor,
    usage,
    status,
    priceCents,
    response,
    createdAt,
    __v,
    fileId,
    ...rest
  } = r;
  return {
    _id,
    filename,
    format,
    quantity,
    scale,
    dimensions,
    colorStatus,
    acceptedMissingColor,
    usage,
    status,
    priceCents,
    response,
    createdAt,
    __v,
    ...(r.userId?.name
      ? { customer: { name: r.userId.name, email: r.userId.email } }
      : {}),
  };
};
export function designRequestsRouter(authenticated) {
  const admitUpload = createUploadCapacity();
  const router = express.Router();
  router.use(authenticated);
  router.get('/', async (req, res) => {
    const page = pageNumber(req, res);
    if (!page) return;
    const filter = { userId: req.user._id };
    const [rows, total] = await Promise.all([
      DesignRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 20)
        .limit(20)
        .lean(),
      DesignRequest.countDocuments(filter),
    ]);
    const jobs = await SlicingJob.find({
      requestId: { $in: rows.map((r) => r._id) },
    }).lean();
    const byRequest = new Map(jobs.map((j) => [String(j.requestId), j]));
    res.json({
      requests: rows.map((row) => ({
        ...publicRequest(row),
        ...(req.user.role === 'admin'
          ? { slicing: publicSlice(byRequest.get(String(row._id))) }
          : {}),
      })),
      ...pageMetadata(page, total),
    });
  });
  router.post(
    '/',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 5,
      keyGenerator: (req) => String(req.user._id),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message:
          'Ya enviaste varias solicitudes. Esperá unos minutos antes de enviar otra.',
      },
    }),
    (req, res, next) => {
      req.designUpload = true;
      next();
    },
    admitUpload,
    multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: limit,
        files: 1,
        fields: 1,
        fieldSize: 8192,
        parts: 2,
      },
    }).single('model'),
    async (req, res) => {
      let raw;
      try {
        raw = JSON.parse(req.body.metadata);
      } catch {
        throw invalid('Revisá los datos de la solicitud.');
      }
      const parsed = metadataSchema.safeParse(raw);
      if (!parsed.success)
        throw invalid(
          'Revisá la cantidad, las medidas y los datos de la solicitud.',
        );
      const data = parsed.data;
      if (data.colorStatus !== 'complete' && !data.acceptedMissingColor)
        return res.status(409).json({
          code: 'COLOR_CONFIRMATION_REQUIRED',
          message:
            'Confirmá si querés enviar el modelo con colores pendientes de revisión.',
        });
      const format = await validateOriginal(req.file);
      const filename = req.file.originalname
        .replace(/[\x00-\x1f\x7f/\\]/g, '_')
        .slice(0, 180);
      const hash = createHash('sha256')
        .update(req.file.buffer)
        .update(JSON.stringify({ ...data, requestId: undefined, filename }))
        .digest('hex');
      const existing = await DesignRequest.findOne({
        userId: req.user._id,
        requestId: data.requestId,
      })
        .select('+requestHash')
        .lean();
      if (existing) {
        if (existing.requestHash !== hash)
          return res.status(409).json({
            message:
              'Esta solicitud ya se usó para otro archivo o medidas. Actualizá tus solicitudes antes de continuar.',
          });
        return res.json(publicRequest(existing));
      }
      if (
        (await DesignRequest.countDocuments({
          userId: req.user._id,
          status: { $ne: 'cerrado' },
        })) >= 20
      )
        return res.status(409).json({
          message:
            'Tenés 20 solicitudes abiertas. Esperá la revisión antes de enviar más.',
        });
      const storage = bucket();
      const upload = storage.openUploadStream(filename, {
        metadata: { userId: req.user._id, format },
      });
      await pipeline(Readable.from([req.file.buffer]), upload);
      let row;
      try {
        row = await DesignRequest.create({
          ...data,
          filename,
          format,
          requestHash: hash,
          fileId: upload.id,
          userId: req.user._id,
        });
      } catch (error) {
        if (error.code === 11000) {
          await storage.delete(upload.id).catch(() => {});
          row = await DesignRequest.findOne({
            userId: req.user._id,
            requestId: data.requestId,
          }).select('+requestHash');
          if (row?.requestHash !== hash)
            return res
              .status(409)
              .json({ message: 'La solicitud ya existe con otros datos.' });
        } else throw error; // Retain the private original on an ambiguous database write; never delete a potentially confirmed request's file.
      }
      res.status(201).json(publicRequest(row.toObject()));
    },
  );
  router.get('/:id/file', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    const filter = {
      _id: req.params.id,
      ...(req.user.role === 'admin' ? {} : { userId: req.user._id }),
    };
    const row = await DesignRequest.findOne(filter).lean();
    if (!row)
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    if (!(await bucket().find({ _id: row.fileId }).limit(1).toArray()).length)
      return res.status(404).json({
        message:
          'Archivo no disponible. Contactanos para revisar la solicitud.',
      });
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="modelo.${row.format}"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`,
    });
    await pipeline(bucket().openDownloadStream(row.fileId), res);
  });
  return router;
}
export function adminDesignRequestsRouter() {
  const router = express.Router();
  router.use((req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : res.status(403).json({ message: 'Acceso reservado a administración.' }),
  );
  router.get('/', async (req, res) => {
    const page = pageNumber(req, res);
    if (!page) return;
    const [rows, total] = await Promise.all([
      DesignRequest.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 20)
        .limit(20)
        .populate('userId', 'name email')
        .lean(),
      DesignRequest.countDocuments(),
    ]);
    const jobs = await SlicingJob.find({
      requestId: { $in: rows.map((r) => r._id) },
    }).lean();
    const byRequest = new Map(jobs.map((j) => [String(j.requestId), j]));
    res.json({
      requests: rows.map((row) => ({
        ...publicRequest(row),
        ...(req.user.role === 'admin'
          ? { slicing: publicSlice(byRequest.get(String(row._id))) }
          : {}),
      })),
      ...pageMetadata(page, total),
    });
  });
  router.patch('/:id', async (req, res) => {
    const parsed = z
      .object({
        status: z.enum(['recibido', 'en_revision', 'presupuestado', 'cerrado']),
        priceCents: z.number().int().min(0).max(1000000000).nullable(),
        response: z.string().trim().max(2000),
        version: z.number().int().min(0),
      })
      .strict()
      .safeParse(req.body);
    if (!mongoose.isValidObjectId(req.params.id) || !parsed.success)
      throw invalid('Revisá el estado, la respuesta y el presupuesto.');
    const { version, ...values } = parsed.data;
    if (values.status === 'presupuestado' && !(values.priceCents > 0))
      throw invalid(
        'Ingresá un precio para marcar la solicitud como presupuestada.',
      );
    const row = await DesignRequest.findOneAndUpdate(
      { _id: req.params.id, __v: version },
      { $set: values, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    ).lean();
    if (!row)
      return res.status(409).json({
        message:
          'La solicitud cambió. Actualizá la lista y volvé a intentarlo.',
      });
    res.json(publicRequest(row));
  });
  return router;
}
