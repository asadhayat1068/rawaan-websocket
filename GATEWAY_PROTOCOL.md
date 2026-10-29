# SMS gateway protocol

The gateway is the Android phone (with a SIM) that sends and receives SMS for the platform. It keeps a
WebSocket connection open to this relay. The relay hands it SMS to send, and forwards the SMS it
receives to the API, which uses them for reverse OTP login (users verify their number by texting a
code to the gateway's number).

```
API ──POST /api/sms/send──▶ relay ──{type:'sms'}──▶ gateway ──▶ SMS out
SMS in ──▶ gateway ──{type:'sms_received'}──▶ relay ──signed POST──▶ API /v1/sms-gateway/inbound
                                        ◀──{type:'ack'|'nack'}──
```

## 1. Connect and authenticate

Connect to `ws://<host>:3819` and authenticate with `GATEWAY_TOKEN`, either:

- in the URL: `ws://<host>:3819/?token=<GATEWAY_TOKEN>`, or
- as the first message: `{"type": "auth", "token": "<GATEWAY_TOKEN>"}`

The relay replies `{"type": "auth_ok"}`, or closes the socket with `4401` for a wrong token. If the relay has no
token configured yet it replies `{"type": "auth_unavailable"}` and keeps the connection open: carry on sending
SMS as before, and retry auth on the next reconnect. Once the relay has `GATEWAY_AUTH_REQUIRED=true`, a client that
has not authenticated within 5 seconds is closed with `4401`.

Reconnect with backoff whenever the socket closes.

## 2. Sending SMS (unchanged)

The relay sends:

```json
{ "type": "sms", "recipient": "+923001234567", "message": "Your code is 123456", "timestamp": "…", "id": "…" }
```

Once `GATEWAY_AUTH_REQUIRED=true`, only authenticated gateways receive these.

The relay also sends plain-text keepalive strings (`Welcome! …`, `Server message: …`). Ignore anything
that is not JSON.

## 3. Forwarding received SMS (new)

Needs the `RECEIVE_SMS` permission and a `BroadcastReceiver` for
`android.provider.Telephony.SMS_RECEIVED`.

For each received SMS:

1. Join multipart PDUs into one body.
2. Give it a stable `id` (a UUID generated once and stored with the message, so a retry reuses it).
3. Store it in a persistent queue (it must survive the app being killed or the phone rebooting).
4. Send it once authenticated:

```json
{ "type": "sms_received", "id": "6f1c…", "from": "+923001234567", "body": "RWN 482913", "received_at": "2026-10-29T04:15:55Z" }
```

`from` is the sender address exactly as Android reports it. `03001234567` and `+923001234567` are
both accepted.

The relay replies with one of:

| Reply | Meaning | Gateway action |
|---|---|---|
| `{"type":"ack","id":…,"status":"accepted"}` | The API processed it (matched a login or not) | Remove from queue |
| `{"type":"ack","id":…,"status":"rejected"}` | Malformed, will never succeed | Remove from queue |
| `{"type":"nack","id":…,"retry":true}` | API unreachable, throttled or misconfigured | Keep and retry with backoff |
| `{"type":"error","id":…}` | Not authenticated | Authenticate, then resend |
| no reply within ~15 s | Connection problem | Resend after reconnect |

Re-sending a message the API already processed is harmless: the API ignores repeated `id`s for 24 hours.

Optional: only forward messages that contain a 6-digit code, or that start with the configured
`REVERSE_OTP_SMS_PREFIX`, to avoid uploading unrelated SMS.

## 4. Rollout order

Outbound SMS stop if `GATEWAY_AUTH_REQUIRED` is turned on before the gateway authenticates. So:

1. Deploy the relay with `GATEWAY_TOKEN` set and `GATEWAY_AUTH_REQUIRED=false`. Every client still
   receives SMS jobs, so the old gateway app keeps working.
2. Ship the gateway update with the same token, and confirm `GET /api/status` shows
   `authenticatedGateways: 1`.
3. Set `GATEWAY_AUTH_REQUIRED=true` and restart the relay. Unauthenticated clients no longer receive SMS jobs.

## Testing without a phone

Use any WebSocket client:

```bash
npx wscat -c "ws://localhost:3819/?token=$GATEWAY_TOKEN"
> {"type":"sms_received","id":"test-1","from":"+923001234567","body":"RWN 482913"}
< {"type":"ack","id":"test-1","status":"accepted"}
```
