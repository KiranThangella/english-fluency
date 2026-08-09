import { Router } from "express";
import { getUserById, getUserByStripeCustomerId, setUserPlan, logEvent } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { verifyStripeSignature } from "../stripeVerify.js";

export const billingRouter = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID; // the $/month premium plan Price ID
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

function stripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY && !!STRIPE_PRICE_ID;
}

// Minimal fetch-based Stripe client — avoids pulling in the full `stripe` npm
// package for three endpoints. Swap for the official SDK if this grows.
async function stripeRequest(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error (HTTP ${res.status})`);
  return data;
}

// GET /api/billing/status — whether Stripe is even configured, for the frontend to know whether to show upgrade UI at all.
billingRouter.get("/status", (_req, res) => {
  res.json({ configured: stripeConfigured() });
});

// POST /api/billing/checkout — creates a Stripe Checkout session for the signed-in user and returns the URL to redirect to.
billingRouter.post("/checkout", requireAuth, async (req, res) => {
  if (!stripeConfigured()) {
    return res.status(501).json({ error: "Billing isn't configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." });
  }
  const user = getUserById(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found." });

  try {
    const session = await stripeRequest("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": STRIPE_PRICE_ID!,
      "line_items[0][quantity]": "1",
      success_url: `${APP_URL}?upgraded=true`,
      cancel_url: `${APP_URL}?upgraded=false`,
      client_reference_id: user.id,
      customer_email: user.email,
      ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : {}),
    });
    res.json({ url: session.url });
    logEvent(user.id, "checkout_started");
  } catch (err) {
    console.error("stripe checkout error:", err);
    res.status(502).json({ error: "Couldn't start checkout. Try again." });
  }
});

// POST /api/billing/webhook — Stripe calls this on subscription events.
// This route receives the RAW request body (not JSON-parsed) so the
// signature can be verified byte-for-byte — see index.ts, which mounts
// express.raw({ type: "application/json" }) for this exact path only.
billingRouter.post("/webhook", async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: "STRIPE_WEBHOOK_SECRET not set." });
  }

  const rawBody = req.body as Buffer; // guaranteed Buffer by express.raw() in index.ts
  try {
    verifyStripeSignature(rawBody, req.header("stripe-signature"), STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn("stripe webhook rejected — bad signature:", err instanceof Error ? err.message : err);
    return res.status(400).json({ error: "Invalid signature." });
  }

  const event = JSON.parse(rawBody.toString("utf8")) as { type?: string; data?: { object?: Record<string, unknown> } };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object as { client_reference_id?: string; customer?: string; subscription?: string };
      if (session.client_reference_id) {
        setUserPlan(session.client_reference_id, "premium", session.customer, session.subscription);
        logEvent(session.client_reference_id, "upgraded_to_premium");
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data?.object as { customer?: string };
      const user = sub.customer ? getUserByStripeCustomerId(sub.customer) : undefined;
      if (user) {
        setUserPlan(user.id, "free");
        logEvent(user.id, "downgraded_to_free");
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("stripe webhook error:", err);
    res.status(500).json({ error: "Webhook handling failed." });
  }
});
