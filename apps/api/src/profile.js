import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { User, SocialIdentity } from './models.js';
import { createAccountServices, passwordOptions } from './account-access.js';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const email = z.string().trim().toLowerCase().pipe(z.email());
export function createProfileRouter({
  services = createAccountServices(),
  webOrigin,
  authLimit,
  save,
  regenerate,
}) {
  const router = Router();
  const summary = async (user) => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    hasPassword: !!user.passwordHash,
    providers: (
      await SocialIdentity.find({ userId: user._id }).select('provider').lean()
    ).map((x) => x.provider),
  });
  const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ message: result.error.issues[0].message });
    req.body = result.data;
    next();
  };
  const confirmIdentity = async (req, res, next) => {
    const user = await User.findById(req.user._id).select(
      '+passwordHash +authVersion',
    );
    if (!user || (user.authVersion || 0) !== (req.session.authVersion || 0))
      return res.status(401).json({ message: 'Iniciá sesión nuevamente.' });
    if (user.passwordHash) {
      if (
        !req.body.currentPassword ||
        !(await argon2.verify(user.passwordHash, req.body.currentPassword))
      )
        return res
          .status(400)
          .json({ message: 'La contraseña actual no es correcta.' });
    } else if (
      !req.session.reauthenticatedAt ||
      Date.now() - req.session.reauthenticatedAt > 5 * 60000
    )
      return res.status(403).json({
        code: 'REAUTH_REQUIRED',
        message:
          'Confirmá tu identidad con Google o Facebook antes de continuar.',
      });
    req.profileUser = user;
    next();
  };
  const renew = async (req, user) => {
    await regenerate(req);
    req.session.userId = String(user._id);
    req.session.authVersion = user.authVersion || 0;
    await save(req);
  };
  router.get('/', async (req, res) =>
    res.json(
      await summary(await User.findById(req.user._id).select('+passwordHash')),
    ),
  );
  router.patch(
    '/',
    validate(z.object({ name: z.string().trim().min(2).max(80) }).strict()),
    async (req, res) => {
      const user = await User.findOneAndUpdate(
        { _id: req.user._id, authVersion: req.user.authVersion || 0 },
        { $set: { name: req.body.name } },
        { new: true },
      ).select('+passwordHash');
      // Accounts created before authVersion was introduced have no field in MongoDB.
      if (!user) {
        const old = await User.findOneAndUpdate(
          { _id: req.user._id, authVersion: { $exists: false } },
          { $set: { name: req.body.name } },
          { new: true },
        ).select('+passwordHash');
        if (old) return res.json(await summary(old));
        return res
          .status(409)
          .json({ message: 'Tu cuenta cambió. Volvé a iniciar sesión.' });
      }
      res.json(await summary(user));
    },
  );
  router.post(
    '/password',
    authLimit,
    validate(
      z
        .object({
          currentPassword: z.string().max(128).optional(),
          password: z.string().min(12, 'Usá al menos 12 caracteres').max(128),
        })
        .strict(),
    ),
    confirmIdentity,
    async (req, res) => {
      const passwordHash = await argon2.hash(
        req.body.password,
        passwordOptions,
      );
      const version = req.profileUser.authVersion || 0;
      const user = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          $or: [
            { authVersion: version },
            ...(version === 0 ? [{ authVersion: { $exists: false } }] : []),
          ],
        },
        {
          $set: { passwordHash },
          $unset: {
            resetTokenHash: 1,
            resetExpiresAt: 1,
            pendingEmail: 1,
            emailChangeTokenHash: 1,
            emailChangeExpiresAt: 1,
          },
          $inc: { authVersion: 1 },
        },
        { new: true },
      ).select('+authVersion +passwordHash');
      if (!user)
        return res
          .status(409)
          .json({ message: 'Tu cuenta cambió. Volvé a iniciar sesión.' });
      await renew(req, user);
      res.json({
        user: await summary(user),
        message: 'Contraseña actualizada. Cerramos tus otras sesiones.',
      });
    },
  );
  router.post(
    '/email',
    authLimit,
    validate(
      z
        .object({ email, currentPassword: z.string().max(128).optional() })
        .strict(),
    ),
    confirmIdentity,
    async (req, res) => {
      if (req.body.email === req.profileUser.email)
        return res
          .status(400)
          .json({ message: 'Ingresá un correo diferente al actual.' });
      if (!services.sendEmailChange)
        return res.status(503).json({
          message:
            'El cambio de email requiere confirmar el nuevo correo. El envío de correos todavía no está disponible.',
        });
      if (await User.exists({ email: req.body.email }))
        return res
          .status(409)
          .json({ message: 'No se puede usar ese correo. Elegí otro.' });
      const token = randomBytes(32).toString('hex'),
        hash = digest(token),
        version = req.profileUser.authVersion || 0;
      const stored = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          $and: [
            {
              $or: [
                { authVersion: version },
                ...(version === 0 ? [{ authVersion: { $exists: false } }] : []),
              ],
            },
            {
              $or: [
                { emailChangeRequestedAt: { $exists: false } },
                {
                  emailChangeRequestedAt: { $lt: new Date(Date.now() - 60000) },
                },
              ],
            },
          ],
        },
        {
          $set: {
            pendingEmail: req.body.email,
            emailChangeTokenHash: hash,
            emailChangeExpiresAt: new Date(Date.now() + 30 * 60000),
            emailChangeRequestedAt: new Date(),
          },
        },
      );
      if (!stored)
        return res.status(429).json({
          message:
            'Esperá un minuto antes de solicitar otro cambio o volvé a iniciar sesión.',
        });
      try {
        await services.sendEmailChange({
          email: req.body.email,
          url: webOrigin + '/perfil#email=' + token,
        });
      } catch {
        await User.updateOne(
          { _id: req.user._id, emailChangeTokenHash: hash },
          {
            $unset: {
              pendingEmail: 1,
              emailChangeTokenHash: 1,
              emailChangeExpiresAt: 1,
            },
          },
        );
        return res.status(502).json({
          message:
            'No pudimos enviar la confirmación. Tu correo actual sigue vigente.',
        });
      }
      res.json({
        message:
          'Enviamos un enlace al nuevo correo. Tu email actual seguirá vigente hasta confirmarlo.',
      });
    },
  );
  router.post(
    '/email/confirm',
    authLimit,
    validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
    async (req, res) => {
      const hash = digest(req.body.token),
        pending = await User.findOne({
          _id: req.user._id,
          emailChangeTokenHash: hash,
          emailChangeExpiresAt: { $gt: new Date() },
        }).select('+pendingEmail');
      if (!pending)
        return res.status(400).json({
          message:
            'El enlace venció o ya fue utilizado. Solicitá un nuevo cambio de email.',
        });
      let user;
      try {
        user = await User.findOneAndUpdate(
          {
            _id: req.user._id,
            emailChangeTokenHash: hash,
            emailChangeExpiresAt: { $gt: new Date() },
          },
          {
            $set: { email: pending.pendingEmail },
            $unset: {
              pendingEmail: 1,
              emailChangeTokenHash: 1,
              emailChangeExpiresAt: 1,
              resetTokenHash: 1,
              resetExpiresAt: 1,
            },
            $inc: { authVersion: 1 },
          },
          { new: true },
        ).select('+authVersion +passwordHash');
      } catch (error) {
        if (error.code === 11000)
          return res.status(409).json({
            message:
              'Ese correo ya no está disponible. Solicitá el cambio a otro.',
          });
        throw error;
      }
      if (!user)
        return res.status(400).json({ message: 'El enlace ya fue utilizado.' });
      await renew(req, user);
      res.json({
        user: await summary(user),
        message: 'Email actualizado. Usá tu nuevo correo para ingresar.',
      });
    },
  );
  return router;
}
