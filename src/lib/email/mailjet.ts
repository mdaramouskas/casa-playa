// Sending mail through Mailjet's Send API v3.1.
//
// Mailjet rather than a new provider because casaplaya.gr already publishes
// `spf.mailjet.com` in its SPF record — so mail from `kratiseis@casaplaya.gr`
// authenticates without touching the domain's DNS.
//
// Plain `fetch`: this call has no fixed-IP requirement, so it does NOT go
// through the paycenter proxy (`lib/paycenter/egress.ts`). Only the ticketing
// call does.

export interface Mail {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
  /** Ends up in Mailjet's message log — the booking reference. */
  customId?: string;
}

const ENDPOINT = "https://api.mailjet.com/v3.1/send";

function credentials(): { key: string; secret: string } | null {
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET_KEY;
  return key && secret ? { key, secret } : null;
}

/**
 * Sends one message. Returns whether it was handed to Mailjet.
 *
 * Never throws. Every caller is on a path where the money has already moved —
 * a booking that is paid for must not be left looking failed because an email
 * provider had a bad minute. A failure is logged with the reference so it can
 * be re-sent by hand.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const creds = credentials();

  // No credentials yet (ZanteWize still owes them). Log the message instead of
  // silently dropping it, so the flow can be exercised end to end meanwhile.
  if (!creds) {
    console.info("[email] no Mailjet credentials — not sent", {
      to: mail.to,
      subject: mail.subject,
      customId: mail.customId,
    });
    return false;
  }

  const from = {
    Email: process.env.MAIL_FROM_EMAIL ?? "kratiseis@casaplaya.gr",
    Name: process.env.MAIL_FROM_NAME ?? "Casa Playa",
  };
  // Replies go to the address the business actually reads. The From address
  // exists to send, not to receive — casaplaya.gr has no MX record.
  const replyTo = process.env.MAIL_REPLY_TO ?? "bananacasaplaya@gmail.com";

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${creds.key}:${creds.secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: from,
            To: [{ Email: mail.to, Name: mail.toName ?? mail.to }],
            ReplyTo: { Email: replyTo },
            Subject: mail.subject,
            TextPart: mail.text,
            HTMLPart: mail.html,
            ...(mail.customId ? { CustomID: mail.customId } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[email] Mailjet rejected the message", {
        status: response.status,
        body: (await response.text()).slice(0, 500),
        customId: mail.customId,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Mailjet call failed", {
      customId: mail.customId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
