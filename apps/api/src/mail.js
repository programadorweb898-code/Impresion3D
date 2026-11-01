export function createMailer(env = {}, transport = fetch) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return async ({ email, subject, text, idempotencyKey }) => {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email],
        subject,
        text,
      }),
    });
    if (!response.ok) throw new Error('Email delivery failed');
  };
}
