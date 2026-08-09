import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60; // reject events signed more than 5 min ago (replay protection)

/**
 * Verifies a Stripe webhook signature by hand — same algorithm as
 * stripe.webhooks.constructEvent, without pulling in the full SDK.
 *
 * header format: "t=<timestamp>,v1=<hex hmac>[,v0=...]"
 * signed payload: `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook secret.
 *
 * Throws on any failure (missing header, bad format, stale timestamp, mismatch).
 * Returns nothing on success — call it, then trust req.body.
 */
export function verifyStripeSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): void {
  if (!signatureHeader) throw new Error("missing stripe-signature header");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) throw new Error("malformed stripe-signature header");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    throw new Error("stripe-signature timestamp outside tolerance (possible replay)");
  }

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(v1, "utf8");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error("stripe-signature mismatch");
  }
}
