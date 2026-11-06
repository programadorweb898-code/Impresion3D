import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User, SocialIdentity } from './models.js';

// This receipt is created only after a successful Google OAuth exchange. It
// is bound to this browser session and contains no Google access/refresh token.
export async function googleConfirmationUser(
  req,
  receipt = req.session.googleSignIn,
) {
  if (
    !receipt ||
    receipt.expires <= Date.now() ||
    receipt.nonce !== req.session.googleSignIn?.nonce
  )
    return null;
  const user = await User.findById(receipt.userId).select(
    '+authVersion +passwordHash',
  );
  if (
    !user ||
    user.email !== receipt.email ||
    (user.authVersion || 0) !== receipt.authVersion
  )
    return null;
  return user;
}

export async function completeGoogleSignIn(
  req,
  user,
  receipt,
  { regenerate, save },
) {
  const current = await googleConfirmationUser(req, receipt);
  if (
    !current ||
    String(current._id) !== String(user._id) ||
    current.verificationRequired
  )
    return false;
  const identity = await SocialIdentity.findOne({
    provider: 'google',
    subject: receipt.subject,
  });
  if (
    (identity && String(identity.userId) !== String(user._id)) ||
    (await SocialIdentity.exists({
      provider: 'google',
      userId: user._id,
      subject: { $ne: receipt.subject },
    }))
  )
    return false;
  try {
    if (!identity)
      await SocialIdentity.create({
        provider: 'google',
        subject: receipt.subject,
        userId: user._id,
      });
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
  await regenerate(req);
  req.session.userId = String(current._id);
  req.session.authVersion = current.authVersion || 0;
  req.session.reauthenticatedAt = Date.now();
  await save(req);
  return true;
}

export function googleConfirmationRouter({
  services,
  authLimit,
  regenerate,
  save,
}) {
  const router = Router();
  router.get('/google-confirmation', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = await googleConfirmationUser(req);
    if (!user) return res.json({ pending: false });
    const identities = await SocialIdentity.find({ userId: user._id })
      .select('provider')
      .lean();
    res.json({
      pending: true,
      email: user.email,
      hasPassword: !!user.passwordHash,
      facebook:
        !!services.providers.facebook &&
        identities.some((x) => x.provider === 'facebook'),
    });
  });
  router.delete('/google-confirmation', async (req, res) => {
    delete req.session.googleSignIn;
    if (req.session.oauth?.googleConfirmation) delete req.session.oauth;
    await save(req);
    res.json({ pending: false });
  });
  router.post('/google-confirmation', authLimit, async (req, res) => {
    const parsed = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: 'Ingresá la contraseña de tu cuenta.' });
    const user = await googleConfirmationUser(req),
      receipt = req.session.googleSignIn;
    if (!user)
      return res
        .status(409)
        .json({
          code: 'GOOGLE_CONFIRMATION_EXPIRED',
          message: 'La solicitud venció. Volvé a elegir Continuar con Google.',
        });
    if (
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, parsed.data.password))
    )
      return res
        .status(400)
        .json({ message: 'La contraseña no es correcta. Intentá nuevamente.' });
    if (user.verificationRequired)
      return res
        .status(403)
        .json({ message: 'Confirmá tu correo antes de ingresar.' });
    if (!(await completeGoogleSignIn(req, user, receipt, { regenerate, save })))
      return res
        .status(409)
        .json({
          message: 'Tu cuenta cambió. Volvé a elegir Continuar con Google.',
        });
    res.json({ url: '/' });
  });
  return router;
}
