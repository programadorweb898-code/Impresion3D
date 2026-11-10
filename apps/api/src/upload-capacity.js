// Admission is per process: sufficient for the current single Render instance.
// One upload per customer also serializes the open-request quota check.
export function createUploadCapacity(maxActive = 2) {
  let active = 0;
  const customers = new Set();
  return (req, res, next) => {
    const customer = String(req.user._id);
    if (active >= maxActive || customers.has(customer)) {
      res.set('Retry-After', '5');
      return res.status(429).json({
        message:
          'Hay archivos enviándose en este momento. Esperá unos segundos y volvé a intentarlo.',
      });
    }
    active++;
    customers.add(customer);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      customers.delete(customer);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
