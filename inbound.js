const crypto = require('crypto');

const WEBHOOK_URL = process.env.INBOUND_SMS_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.SMS_GATEWAY_WEBHOOK_SECRET;
const WEBHOOK_TIMEOUT_MS = parseInt(process.env.INBOUND_SMS_WEBHOOK_TIMEOUT_MS || '10000', 10);

/**
 * Mask a phone number for logs, e.g. +92300****567
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  const value = String(phone || '');
  return value.length > 7 ? `${value.slice(0, 6)}****${value.slice(-3)}` : '****';
}

/**
 * Forward an SMS received by the gateway device to the API, signed with the shared secret.
 *
 * The API expects:
 *   X-Gateway-Timestamp: unix seconds
 *   X-Gateway-Signature: hex HMAC-SHA256 of "{timestamp}.{raw body}"
 *
 * @param {{id: string, from: string, body: string, received_at?: string}} sms
 * @returns {Promise<{ok: boolean, retry: boolean, status?: number, error?: string}>}
 *   ok: the API accepted it; retry: the gateway should send it again later
 */
async function forwardInboundSms(sms) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    return { ok: false, retry: true, error: 'Inbound SMS forwarding is not configured' };
  }

  const body = JSON.stringify({
    id: sms.id,
    from: sms.from,
    body: sms.body,
    received_at: sms.received_at || new Date().toISOString()
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Gateway-Timestamp': timestamp,
        'X-Gateway-Signature': signature
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
    });

    // Read the whole response so the API has finished handling the SMS before it is acknowledged
    const text = await response.text();

    if (response.ok) {
      return { ok: true, retry: false, status: response.status };
    }

    // A malformed message will never succeed, so stop the gateway retrying it.
    // Auth, throttling and server errors may succeed later, so keep retrying those.
    const retry = response.status === 401 || response.status === 429 || response.status >= 500;
    return { ok: false, retry, status: response.status, error: text };
  } catch (error) {
    return { ok: false, retry: true, error: error.message };
  }
}

module.exports = { forwardInboundSms, maskPhone };
