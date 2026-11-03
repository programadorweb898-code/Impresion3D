import { createHmac } from 'node:crypto';

// A missing address doesn't imply a declined permission. Check the grant
// without retaining the access token or exposing provider responses in logs.
export async function facebookEmailPermission({
  transport,
  version,
  clientSecret,
  accessToken,
}) {
  try {
    const url = new URL(`https://graph.facebook.com/${version}/me/permissions`);
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', clientSecret).update(accessToken).digest('hex'),
    );
    const response = await transport(url.href, {
      headers: { Authorization: 'Bearer ' + accessToken },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return 'unknown';
    const body = await response.json();
    if (!Array.isArray(body?.data)) return 'unknown';
    const permission = body.data.find((item) => item?.permission === 'email');
    if (!permission) return 'not_granted';
    return ['granted', 'declined', 'expired'].includes(permission.status)
      ? permission.status
      : 'unknown';
  } catch {
    return 'unknown';
  }
}
