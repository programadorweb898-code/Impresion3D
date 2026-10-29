import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
export const maxImageBytes = 5 * 1024 * 1024;
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageBytes, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      return callback(
        Object.assign(new Error('Usá una foto JPG, PNG o WebP'), {
          status: 400,
        }),
      );
    callback(null, true);
  },
}).single('image');
export async function normalizeImage(buffer) {
  try {
    const image = sharp(buffer, {
      limitInputPixels: 20000000,
      failOn: 'warning',
    });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1)
      throw new Error('Formato no permitido');
    const { data, info } = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw Object.assign(
      new Error(
        'La foto no es válida. Usá JPG, PNG o WebP, sin animación y hasta 20 megapíxeles.',
      ),
      { status: 400 },
    );
  }
}
export function createImageStorage({ cloudName, apiKey, apiSecret }) {
  if (!cloudName && !apiKey && !apiSecret) return null;
  if (!cloudName || !apiKey || !apiSecret)
    throw new Error(
      'Completá las tres variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET',
    );
  const credentials = {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  };
  return {
    async upload(buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            ...credentials,
            resource_type: 'image',
            public_id: 'impresion3d/products/' + randomUUID(),
            overwrite: false,
            timeout: 30000,
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        stream.end(buffer);
      });
      if (!result?.secure_url?.startsWith('https://res.cloudinary.com/'))
        throw new Error('Respuesta de imágenes inválida');
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      };
    },
    async remove(publicId) {
      if (!publicId?.startsWith('impresion3d/products/')) return;
      await cloudinary.uploader.destroy(publicId, {
        ...credentials,
        resource_type: 'image',
        invalidate: true,
        timeout: 30000,
      });
    },
  };
}
