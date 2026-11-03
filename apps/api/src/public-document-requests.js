import { randomUUID } from 'node:crypto';
import { legalPageFromPath } from '@impresion3d/shared';

// Only public document paths are recorded: never query strings, cookies,
// addresses, account identifiers, or provider authorization codes.
export function observePublicDocuments({
  log = (entry) => console.info(JSON.stringify(entry)),
} = {}) {
  return (req, res, next) => {
    if (req.path !== '/robots.txt' && !legalPageFromPath(req.path))
      return next();
    const requestId = randomUUID();
    const started = Date.now();
    const userAgent = req.get('user-agent') || '';
    const entry = {
      event: 'public_document_request',
      requestId,
      method: req.method,
      path: req.path,
      crawler: /facebookexternalhit|facebot/i.test(userAgent)
        ? 'meta'
        : 'other',
    };
    res.set('x-request-id', requestId);
    log({ ...entry, phase: 'received' });
    res.on('finish', () => {
      log({
        ...entry,
        phase: 'completed',
        status: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    next();
  };
}
