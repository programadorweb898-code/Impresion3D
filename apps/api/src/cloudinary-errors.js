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
      message:
        'Cloudinary no reconoce la API Key en el entorno seleccionado. Verificá que API Key y Cloud Name pertenezcan al mismo entorno; Key Name no es ninguno de esos valores.',
    };
  }
  if (
    /invalid timestamp|timestamp.*(?:too old|future|expired|invalid)|stale request|expired.*(?:request|signature)/i.test(
      message,
    )
  ) {
    return {
      reason: 'request_time_rejected',
      message:
        'Cloudinary rechazó la fecha de la solicitud. Es un problema del firmado o del reloj del servidor; no hace falta cambiar tus claves todavía.',
    };
  }
  if (
    /invalid signature|signature.*(?:invalid|mismatch)|signature verification/i.test(
      message,
    )
  ) {
    return {
      reason: 'signature_rejected',
      message:
        'Cloudinary rechazó la firma de la solicitud. Hay que comprobar el firmado del backend y que el API Secret corresponda a esa misma API Key.',
    };
  }
  if (
    /unknown cloud|invalid cloud[_ ]?name|cloud[_ ]?name.*(?:invalid|not found|unknown)/i.test(
      message,
    )
  ) {
    return {
      reason: 'cloud_not_recognized',
      message:
        'Cloudinary no reconoce el Cloud Name. Debe ser el identificador del entorno de productos, no Key Name ni el nombre de tu cuenta.',
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
      message:
        'Cloudinary no permite esta operación con la clave actual. Revisá los permisos o restricciones de la clave y del entorno.',
    };
  }
  if (status === 401) {
    return {
      reason: 'authentication_rejected',
      message:
        'Cloudinary rechazó la autenticación (401), sin una causa reconocida. No se puede determinar todavía qué variable o permiso lo provoca.',
    };
  }
  return {
    reason: 'provider_error',
    message: 'No se pudo guardar la foto en Cloudinary. Intentá nuevamente.',
  };
}
