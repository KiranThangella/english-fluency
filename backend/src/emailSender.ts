const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "English Fluency <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

/**
 * Sends a transactional email via Resend's REST API (no SDK — same
 * lightweight pattern as the Stripe integration in routes/billing.ts).
 * If RESEND_API_KEY isn't set, logs the email to the console instead of
 * sending it, so password reset / verification are fully testable in local
 * dev without setting up a real email provider. Swap RESEND_API_KEY for
 * another provider's key + this function's body if you use something else.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!emailConfigured()) {
    console.log(`\n[DEV EMAIL — no RESEND_API_KEY set, not actually sent]\nTo: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Don't throw — a failed email shouldn't 500 the signup/reset request.
    // The user can always use "resend verification" / "forgot password" again.
    console.error(`sendEmail failed (HTTP ${res.status}): ${errText}`);
  }
}
