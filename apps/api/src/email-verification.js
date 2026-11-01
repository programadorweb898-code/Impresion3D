import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from './models.js';
const digest = (token) => createHash('sha256').update(token).digest('hex');
const responseMessage =
  'Si tu cuenta necesita confirmación, recibirás un enlace por correo. Revisá también spam.';
export async function sendVerification(userId, services, webOrigin) {
  const token = randomBytes(32).toString('hex');
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      verificationRequired: true,
      $or: [
        { verificationRequestedAt: { $exists: false } },
        { verificationRequestedAt: { $lt: new Date(Date.now() - 60000) } },
      ],
    },
    {
      $set: {
        verificationTokenHash: digest(token),
        verificationExpiresAt: new Date(Date.now() + 30 * 60000),
        verificationRequestedAt: new Date(),
      },
    },
  );
  if (!user) return;
  try {
    await services.sendVerification({
      email: user.email,
      url: webOrigin + '/login#verify=' + token,
    });
  } catch {
    console.error(
      JSON.stringify({ event: 'verification_email_delivery_failed' }),
    );
  }
}
export function createVerificationRouter({
  services,
  webOrigin,
  authLimit,
  regenerate,
  save,
}) {
  const router = Router();
  router.post('/resend-verification', authLimit, async (req, res) => {
    const result = z
      .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
      .safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ message: 'Ingresá un correo válido.' });
    if (!services.sendVerification)
      return res.status(503).json({
        message: 'El envío de confirmaciones todavía no está disponible.',
      });
    const user = await User.findOne({
      email: result.data.email,
      verificationRequired: true,
    });
    if (user) await sendVerification(user._id, services, webOrigin);
    res.json({ message: responseMessage });
  });
  router.post('/verify-email', authLimit, async (req, res) => {
    const parsed = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(12).max(128),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        message:
          'Enlace inválido o contraseña demasiado corta. Usá al menos 12 caracteres.',
      });
    const filter = {
      verificationRequired: true,
      verificationTokenHash: digest(parsed.data.token),
      verificationExpiresAt: { $gt: new Date() },
    };
    if (!(await User.exists(filter)))
      return res.status(400).json({
        message: 'El enlace venció o ya fue utilizado. Solicitá uno nuevo.',
      });
    // The email owner chooses the final password, so a preregistration cannot plant someone else's password.
    const passwordHash = await argon2.hash(parsed.data.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await User.findOneAndUpdate(filter, {
      $set: {
        passwordHash,
        emailVerifiedAt: new Date(),
        verificationRequired: false,
      },
      $unset: {
        verificationTokenHash: 1,
        verificationExpiresAt: 1,
        resetTokenHash: 1,
        resetExpiresAt: 1,
      },
      $inc: { authVersion: 1 },
    });
    if (!user)
      return res.status(400).json({ message: 'El enlace ya fue utilizado.' });
    await regenerate(req);
    await save(req);
    res.json({
      message:
        'Correo confirmado. Iniciá sesión con la contraseña que acabás de elegir.',
    });
  });
  return router;
}
