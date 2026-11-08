import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { DesignRequest, SlicerWorker, SlicingJob, User } from './models.js';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const leaseMs = 5 * 60 * 1000;
const validId = (id) => /^[a-f0-9]{24}$/i.test(id || '');
const profilesSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,40}$/),
        name: z.string().trim().min(1).max(80),
        material: z.enum(['PLA', 'PETG', 'TPU']),
      })
      .strict(),
  )
  .min(1)
  .max(10)
  .refine((ps) => new Set(ps.map((p) => p.id)).size === ps.length);
const publicWorker = (w) => ({
  _id: w._id,
  name: w.name,
  profiles: w.profiles || [],
  lastSeenAt: w.lastSeenAt,
  revoked: !!w.revokedAt,
  pairingExpiresAt: w.pairingExpiresAt,
});
export const publicSlice = (j) =>
  j
    ? {
        _id: j._id,
        state: j.state,
        profileName: j.profileName,
        material: j.material,
        result: j.result,
        error: j.error,
        finishedAt: j.finishedAt,
        attempts: j.attempts,
      }
    : null;
const admin = (req, res, next) =>
  req.user.role === 'admin'
    ? next()
    : res.status(403).json({ message: 'Acceso reservado a administración.' });
export function adminSlicingRouter() {
  const router = express.Router();
  router.use(admin);
  router.get('/workers', async (req, res) =>
    res.json({
      workers: (
        await SlicerWorker.find({ ownerId: req.user._id })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
      ).map(publicWorker),
    }),
  );
  router.post(
    '/workers',
    rateLimit({
      windowMs: 600000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const parsed = z
        .object({ name: z.string().trim().min(1).max(60) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: 'Ingresá un nombre para tu PC.' });
      if (
        (await SlicerWorker.countDocuments({
          ownerId: req.user._id,
          revokedAt: null,
        })) >= 10
      )
        return res.status(409).json({
          message: 'Desconectá una PC anterior antes de crear otra conexión.',
        });
      const code = randomBytes(9).toString('hex').toUpperCase();
      const row = await SlicerWorker.create({
        ownerId: req.user._id,
        authVersion: req.user.authVersion || 0,
        name: parsed.data.name,
        pairingHash: hash(code),
        pairingExpiresAt: new Date(Date.now() + 600000),
      });
      res.status(201).json({ worker: publicWorker(row), code });
    },
  );
  router.delete('/workers/:id', async (req, res) => {
    if (!validId(req.params.id))
      return res.status(404).json({ message: 'PC no encontrada.' });
    const row = await SlicerWorker.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      {
        $set: { revokedAt: new Date() },
        $unset: { tokenHash: 1, pairingHash: 1 },
      },
    );
    if (!row) return res.status(404).json({ message: 'PC no encontrada.' });
    res.status(204).end();
  });
  router.post('/requests/:id', async (req, res) => {
    const parsed = z
      .object({
        workerId: z.string().regex(/^[a-f0-9]{24}$/i),
        profileId: z.string().max(40),
      })
      .strict()
      .safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success)
      return res
        .status(400)
        .json({ message: 'Elegí una PC y un perfil de laminado.' });
    const request = await DesignRequest.findById(req.params.id).lean();
    if (!request || request.status === 'cerrado')
      return res
        .status(409)
        .json({ message: 'Solicitud no disponible para laminar.' });
    if (!['3mf', 'stl'].includes(request.format))
      return res.status(400).json({
        message:
          'Para laminado con Bambu Studio usá 3MF o STL. Revisá este GLB manualmente.',
      });
    const worker = await SlicerWorker.findOne({
      _id: parsed.data.workerId,
      ownerId: req.user._id,
      revokedAt: null,
    })
      .select('+tokenHash')
      .lean();
    const profile = worker?.profiles?.find(
      (p) => p.id === parsed.data.profileId,
    );
    if (!worker?.tokenHash || !profile)
      return res.status(409).json({
        message:
          'Conectá la PC y configurá sus perfiles antes de enviar el laminado.',
      });
    const values = {
      workerId: worker._id,
      profileId: profile.id,
      profileName: profile.name,
      material: profile.material,
      state: 'queued',
      attempts: 0,
      error: null,
      result: null,
      finishedAt: null,
      leaseUntil: null,
    };
    let job = await SlicingJob.findOne({ requestId: request._id });
    if (job) {
      const changed = await SlicingJob.findOneAndUpdate(
        { _id: job._id, state: { $in: ['complete', 'failed'] } },
        { $set: values, $unset: { leaseHash: 1 } },
        { new: true },
      );
      if (!changed)
        return res
          .status(409)
          .json({ message: 'Este laminado ya está en cola o en proceso.' });
      job = changed;
    } else {
      try {
        job = await SlicingJob.create({ requestId: request._id, ...values });
      } catch (e) {
        if (e.code === 11000)
          return res.status(409).json({
            message: 'La solicitud ya tiene un laminado. Actualizá la lista.',
          });
        throw e;
      }
    }
    res.status(201).json({ slicing: publicSlice(job) });
  });
  return router;
}
// Mounted before cookie CSRF: these routes accept only a scoped bearer credential.
export function slicerWorkerRouter() {
  const router = express.Router();
  router.get('/download', (req, res) =>
    res.download(
      fileURLToPath(
        new URL('../../../scripts/slicer-worker.mjs', import.meta.url),
      ),
      'mundo3d-worker.mjs',
    ),
  );
  router.get('/example', (req, res) =>
    res.download(
      fileURLToPath(
        new URL('../../../scripts/slicer-worker.example.json', import.meta.url),
      ),
      'perfiles-mundo3d.json',
    ),
  );
  router.post(
    '/pair',
    rateLimit({
      windowMs: 900000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const parsed = z
        .object({
          code: z.string().regex(/^[A-F0-9]{18}$/),
          secret: z.string().regex(/^[a-f0-9]{64}$/),
          profiles: profilesSchema,
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: 'Código o perfiles inválidos.' });
      const row = await SlicerWorker.findOne({
        pairingHash: hash(parsed.data.code),
        pairingExpiresAt: { $gt: new Date() },
        revokedAt: null,
      }).lean();
      const owner =
        row && (await User.findById(row.ownerId).select('+authVersion'));
      if (
        !owner ||
        owner.role !== 'admin' ||
        (owner.authVersion || 0) !== row.authVersion
      )
        return res.status(401).json({
          message:
            'El código venció o no es válido. Generá otro desde administración.',
        });
      const worker = await SlicerWorker.findOneAndUpdate(
        { _id: row._id, pairingHash: hash(parsed.data.code), revokedAt: null },
        {
          $set: {
            tokenHash: hash(parsed.data.secret),
            profiles: parsed.data.profiles,
            lastSeenAt: new Date(),
          },
          $unset: { pairingHash: 1, pairingExpiresAt: 1 },
        },
        { new: true },
      );
      if (!worker)
        return res.status(401).json({ message: 'El código ya fue utilizado.' });
      res.json({ workerId: worker._id });
    },
  );
  router.use(async (req, res, next) => {
    const secret = /^Bearer ([a-f0-9]{64})$/.exec(
      req.get('authorization') || '',
    )?.[1];
    const worker =
      secret &&
      (await SlicerWorker.findOne({
        tokenHash: hash(secret),
        revokedAt: null,
      }).lean());
    const owner =
      worker && (await User.findById(worker.ownerId).select('+authVersion'));
    if (
      !owner ||
      owner.role !== 'admin' ||
      (owner.authVersion || 0) !== worker.authVersion
    )
      return res
        .status(401)
        .json({ message: 'Conexión de PC no válida. Volvé a vincularla.' });
    req.worker = worker;
    next();
  });
  router.post('/claim', async (req, res) => {
    await SlicerWorker.updateOne(
      { _id: req.worker._id },
      { $set: { lastSeenAt: new Date() } },
    );
    const exhausted = await SlicingJob.find({
      workerId: req.worker._id,
      state: 'processing',
      leaseUntil: { $lt: new Date() },
      attempts: { $gte: 3 },
    })
      .select('_id')
      .limit(20)
      .lean();
    if (exhausted.length)
      await SlicingJob.updateMany(
        {
          _id: { $in: exhausted.map((j) => j._id) },
          state: 'processing',
          leaseUntil: { $lt: new Date() },
        },
        {
          $set: {
            state: 'failed',
            error:
              'La PC perdió la conexión durante tres intentos. Revisá el equipo y reintentá desde administración.',
            finishedAt: new Date(),
          },
        },
      );
    const token = randomBytes(32).toString('hex');
    const job = await SlicingJob.findOneAndUpdate(
      {
        workerId: req.worker._id,
        attempts: { $lt: 3 },
        $or: [
          { state: 'queued' },
          { state: 'processing', leaseUntil: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          state: 'processing',
          leaseHash: hash(token),
          leaseUntil: new Date(Date.now() + leaseMs),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    ).lean();
    if (!job) return res.status(204).end();
    const request = await DesignRequest.findById(job.requestId).lean();
    if (!request || request.status === 'cerrado') {
      await SlicingJob.updateOne(
        { _id: job._id, leaseHash: hash(token) },
        {
          $set: {
            state: 'failed',
            error: 'La solicitud ya no está disponible.',
          },
        },
      );
      return res.status(204).end();
    }
    res.json({
      jobId: job._id,
      lease: token,
      profileId: job.profileId,
      format: request.format,
      colorStatus: request.colorStatus,
      scale: request.scale,
      quantity: request.quantity,
    });
  });
  const active = async (req, res, next) => {
    if (!validId(req.params.id))
      return res.status(404).json({ message: 'Trabajo no encontrado.' });
    const lease = req.get('x-slicing-lease') || '';
    const job = await SlicingJob.findOne({
      _id: req.params.id,
      workerId: req.worker._id,
      state: 'processing',
      leaseHash: hash(lease),
      leaseUntil: { $gt: new Date() },
    }).lean();
    if (!job)
      return res.status(409).json({
        message: 'El turno de este laminado venció o fue reemplazado.',
      });
    req.job = job;
    req.leaseFilter = {
      _id: job._id,
      workerId: req.worker._id,
      state: 'processing',
      leaseHash: hash(lease),
      leaseUntil: { $gt: new Date() },
    };
    next();
  };
  router.post('/jobs/:id/heartbeat', active, async (req, res) => {
    const result = await SlicingJob.updateOne(req.leaseFilter, {
      $set: { leaseUntil: new Date(Date.now() + leaseMs) },
    });
    if (!result.matchedCount)
      return res.status(409).json({ message: 'Turno vencido.' });
    await SlicerWorker.updateOne(
      { _id: req.worker._id },
      { $set: { lastSeenAt: new Date() } },
    );
    res.status(204).end();
  });
  router.get('/jobs/:id/file', active, async (req, res) => {
    const request = await DesignRequest.findById(req.job.requestId).lean();
    if (!request) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'designOriginals',
    });
    if (!(await bucket.find({ _id: request.fileId }).limit(1).toArray()).length)
      return res.status(404).end();
    res.type('application/octet-stream');
    await pipeline(bucket.openDownloadStream(request.fileId), res);
  });
  router.post('/jobs/:id/result', active, async (req, res) => {
    const parsed = z
      .union([
        z
          .object({
            ok: z.literal(true),
            grams: z.number().positive().max(100000),
            seconds: z.number().positive().max(36000000),
            plates: z.number().int().positive().max(1000),
          })
          .strict(),
        z
          .object({
            ok: z.literal(false),
            code: z.enum([
              'SLICER_FAILED',
              'TIMEOUT',
              'PROFILE_INVALID',
              'UNSUPPORTED',
              'RESULT_INVALID',
              'CONNECTION_LOST',
            ]),
          })
          .strict(),
      ])
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: 'Resultado de laminado inválido.' });
    const data = parsed.data;
    const errors = {
      SLICER_FAILED:
        'Bambu Studio no pudo laminar el archivo. Revisá el registro local y los perfiles.',
      TIMEOUT: 'El laminado superó el tiempo máximo.',
      PROFILE_INVALID: 'El perfil local no está disponible o no es válido.',
      UNSUPPORTED:
        'El formato o la cantidad de filamentos requiere revisión manual.',
      RESULT_INVALID: 'El laminador no devolvió gramos y tiempo válidos.',
      CONNECTION_LOST: 'Se perdió la conexión durante el laminado.',
    };
    const result = await SlicingJob.updateOne(req.leaseFilter, {
      $set: {
        state: data.ok ? 'complete' : 'failed',
        result: data.ok
          ? { grams: data.grams, seconds: data.seconds, plates: data.plates }
          : null,
        error: data.ok ? null : errors[data.code],
        finishedAt: new Date(),
      },
      $unset: { leaseHash: 1, leaseUntil: 1 },
    });
    if (!result.matchedCount)
      return res.status(409).json({ message: 'Turno vencido.' });
    res.status(204).end();
  });
  return router;
}
