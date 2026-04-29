const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "English Skills AI <onboarding@resend.dev>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams) {
  if (!RESEND_API_KEY) {
    console.error("[resend] RESEND_API_KEY is not defined");
    return { success: false, error: "RESEND_API_KEY is missing" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, id: data.id };
    } else {
      console.error("[resend] Error response:", data);
      return { success: false, error: data.message || "Unknown Resend error" };
    }
  } catch (error) {
    console.error("[resend] Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendEmailBatch(
  emails: SendEmailParams[],
  batchSize = 2,
  delayMs = 1100
) {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(email => sendEmail(email)));

    results.forEach(res => {
      if (res.success) {
        sent++;
      } else {
        failed++;
        if (res.error) errors.push(res.error);
      }
    });

    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed, errors };
}
