// SMS покупцю через TurboSMS (https://turbosms.ua). Потрібні TURBOSMS_TOKEN і TURBOSMS_SENDER (імʼя відправника,
// зареєстроване в TurboSMS). Без них нічого не робить. Формат запиту — за документацією TurboSMS HTTP API.
export const smsReady = () => !!process.env.TURBOSMS_TOKEN && !!process.env.TURBOSMS_SENDER;

export async function sendSms(phone, text) {
  if (!smsReady()) return { skipped: true };
  try {
    const res = await fetch('https://api.turbosms.ua/message/send.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.TURBOSMS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: [String(phone).replace(/^\+/, '')], sms: { sender: process.env.TURBOSMS_SENDER, text } }),
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && (json.response_code === 0 || json.response_code === undefined);
    if (!ok) console.error('sms failed', res.status, JSON.stringify(json).slice(0, 200));
    return { ok };
  } catch (err) {
    console.error('sms error', err);
    return { ok: false };
  }
}
