import { modelUpload, validateProductModel } from './product-models.js';
import { Product } from './models.js';
import { cloudinaryFailure } from './cloudinary-errors.js';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
export function addModelRoutes(router, storage) {
  router.post(
    '/products/:id/model',
    rateLimit({
      windowMs: 60000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    (req, res, next) => {
      req.productModelUpload = true;
      if (!storage?.uploadModel)
        return res
          .status(503)
          .json({ message: 'Configurá Cloudinary para guardar modelos 3D.' });
      next();
    },
    async (req, res, next) => {
      if (!(await Product.exists({ _id: req.params.id })))
        return res.status(404).json({ message: 'Producto no encontrado' });
      next();
    },
    modelUpload,
    async (req, res) => {
      const validated = await validateProductModel(req.file);
      let model;
      try {
        model = await storage.uploadModel(validated.buffer, validated.format);
        if (validated.sourceFormat) model.sourceFormat = validated.sourceFormat;
      } catch (error) {
        const reference = randomUUID(),
          failure = cloudinaryFailure(error);
        console.warn(
          JSON.stringify({
            event: 'product_model_upload_failed',
            reference,
            reason: failure.reason,
          }),
        );
        res.set('x-request-id', reference);
        return res
          .status(502)
          .json({ message: failure.message.replace('foto', 'modelo') });
      }
      let previous;
      try {
        previous = await Product.findOneAndUpdate(
          { _id: req.params.id },
          { $set: { model } },
          { new: false, runValidators: true },
        );
      } catch {
        return res.status(503).json({
          message:
            'No se pudo confirmar el guardado del modelo. Actualizá la lista antes de reintentar.',
        });
      }
      if (!previous) {
        await storage.removeModel(model.publicId).catch(() => {});
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      if (previous.model?.publicId)
        await storage
          .removeModel(previous.model.publicId)
          .catch(() =>
            console.warn('No se pudo limpiar un modelo reemplazado'),
          );
      res.json({ model });
    },
  );
}
