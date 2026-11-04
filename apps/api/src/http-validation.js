import { validationMessage } from '@impresion3d/shared';
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ message: validationMessage(result.error.issues[0]) });
  req.body = result.data;
  next();
};
