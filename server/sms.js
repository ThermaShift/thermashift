/**
 * SMS follow-up system for ThermaShift.
 * Uses Twilio for sending texts after voice calls.
 * Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS(to, message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[SMS NOT SENT — configure Twilio] To: ${to} | ${message}`);
    return null;
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: TWILIO_FROM,
      Body: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  console.log(`SMS sent to ${to}: ${data.sid}`);
  return data;
}

/**
 * Send post-call follow-up text to a prospect.
 */
export async function sendPostCallSMS(phoneNumber, name) {
  const message = `Hey ${name || 'there'}! Thanks for chatting with ThermaShift. Your cooling efficiency review will be in your inbox shortly. Questions? Just reply to this text or call us back. — Alex, ThermaShift`;
  return sendSMS(phoneNumber, message);
}

/**
 * Send review-ready notification via SMS.
 */
export async function sendReviewReadySMS(phoneNumber, name, savings) {
  const message = `${name || 'Hi'}, your ThermaShift cooling review is ready! We found $${(savings || 0).toLocaleString()}/yr in potential savings. Check your email for the full report, or reply here to discuss. — Alex`;
  return sendSMS(phoneNumber, message);
}
