import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudinaryFailure } from '../src/cloudinary-errors.js';
test('distingue API Key, firma, reloj, entorno y permisos sin exponer detalles del proveedor', () => {
  const cases = [
    [
      { http_code: 401, message: 'Unknown API key 123456789' },
      'api_key_not_recognized',
    ],
    [
      {
        http_code: 401,
        message:
          'Invalid Signature a-secret-signature. String to sign: public_id=test&timestamp=123',
      },
      'signature_rejected',
    ],
    [
      { http_code: 401, message: 'Stale request - reported time is too old' },
      'request_time_rejected',
    ],
    [
      { http_code: 401, message: 'Unknown cloud name private-cloud-name' },
      'cloud_not_recognized',
    ],
    [
      { http_code: 403, message: 'Action not allowed for this key' },
      'permission_denied',
    ],
    [
      { http_code: 401, message: 'Unexpected raw value: confidential' },
      'authentication_rejected',
    ],
    [
      { http_code: 500, message: 'Unexpected raw value: confidential' },
      'provider_error',
    ],
  ];
  for (const [error, expected] of cases) {
    const result = cloudinaryFailure(error);
    assert.equal(result.reason, expected);
    assert.doesNotMatch(
      JSON.stringify(result),
      /123456789|a-secret-signature|public_id=test|private-cloud-name|confidential/,
    );
  }
});
