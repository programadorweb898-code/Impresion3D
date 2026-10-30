import { test } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { Writable, Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createImageStorage } from '../src/images.js';
test('SDK real envía API Key al cloud correcto y firma el multipart con el secreto configurado', async (t) => {
  let target;
  const chunks = [];
  // Replace only the outbound transport; exercise the actual Cloudinary SDK,
  // adapter, parameter serialization and signing without contacting an account.
  t.mock.method(https, 'request', (options, callback) => {
    target = options;
    const request = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
      final(done) {
        const response = Readable.from([
          JSON.stringify({
            secure_url:
              'https://res.cloudinary.com/unit-test-cloud/image/upload/test.webp',
            public_id: 'impresion3d/products/test',
            width: 10,
            height: 10,
          }),
        ]);
        response.statusCode = 200;
        response.headers = {};
        callback(response);
        done();
      },
    });
    request.setTimeout = () => request;
    return request;
  });
  const secret = 'fixture-only-not-a-real-secret';
  const storage = createImageStorage({
    cloudName: 'unit-test-cloud',
    apiKey: '1234567890',
    apiSecret: secret,
  });
  const result = await storage.upload(Buffer.from('test-image-bytes'));
  assert.equal(target.hostname, 'api.cloudinary.com');
  assert.equal(target.path, '/v1_1/unit-test-cloud/image/upload');
  assert.equal(target.method, 'POST');
  const body = Buffer.concat(chunks).toString();
  const fields = Object.fromEntries(
    [...body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  assert.equal(fields.api_key, '1234567890');
  assert.ok(fields.timestamp);
  assert.match(fields.public_id, /^impresion3d\/products\//);
  const signed = Object.keys(fields)
    .filter((k) => !['api_key', 'signature'].includes(k))
    .sort()
    .map((k) => k + '=' + fields[k])
    .join('&');
  assert.equal(
    fields.signature,
    createHash('sha1')
      .update(signed + secret)
      .digest('hex'),
  );
  assert.equal(body.includes(secret), false);
  assert.equal(result.publicId, 'impresion3d/products/test');
});
