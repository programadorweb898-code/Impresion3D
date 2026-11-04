// Classify only known provider messages. Never expose or log the original text:
// invalid-signature errors can contain signing material and credential values.
export function cloudinaryFailure(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const status = Number(error?.http_code) || null;
  if (
    /unknown api[_ ]?key|invalid api[_ ]?key|api[_ ]?key.*(?:unknown|invalid|not found|disabled)/i.test(
      message,
    )
  ) {
    return {
      reason: 'api_key_not_recognized',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  if (
    /invalid timestamp|timestamp.*(?:too old|future|expired|invalid)|stale request|expired.*(?:request|signature)/i.test(
      message,
    )
  ) {
    return {
      reason: 'request_time_rejected',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  if (
    /invalid signature|signature.*(?:invalid|mismatch)|signature verification/i.test(
      message,
    )
  ) {
    return {
      reason: 'signature_rejected',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  if (
    /unknown cloud|invalid cloud[_ ]?name|cloud[_ ]?name.*(?:invalid|not found|unknown)/i.test(
      message,
    )
  ) {
    return {
      reason: 'cloud_not_recognized',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  if (
    status === 403 ||
    /not allowed|permission|access denied|not authorized|disabled/i.test(
      message,
    )
  ) {
    return {
      reason: 'permission_denied',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  if (status === 401) {
    return {
      reason: 'authentication_rejected',
      message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
    };
  }
  return {
    reason: 'provider_error',
    message: 'No pudimos guardar la imagen. Intentá nuevamente más tarde.',
  };
}
