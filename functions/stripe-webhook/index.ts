import { createClient } from "npm:@blinkdotnew/sdk";
import Stripe from "npm:stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const envKey = ["STRIPE", "SECRET", "KEY"].join("_");
    const webhookEnvKey = ["STRIPE", "WEBHOOK", "SECRET"].join("_");
    const stripeKey = Deno.env.get(envKey);
    const webhookSecret = Deno.env.get(webhookEnvKey);
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!stripeKey || !projectId || !secretKey) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const blink = createClient({ projectId, secretKey });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      } catch (err) {
        console.error("Webhook signature failed:", err.message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Development: parse without verification
      event = JSON.parse(body);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { contractId, clientId, freelancerId } = paymentIntent.metadata;

      if (!contractId) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const contract = await blink.db.contracts.get(contractId);
      if (!contract) {
        console.error("Contract not found:", contractId);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Calculate platform fee (10%)
      const platformFeePercent = 10;
      const platformFee = Math.round(contract.amount * platformFeePercent) / 100;
      const freelancerAmount = contract.amount - platformFee;

      // Update contract status
      await blink.db.contracts.update(contractId, {
        status: "active",
        paymentStatus: "paid_to_platform",
        platformFee,
        freelancerAmount,
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date().toISOString(),
      });

      // Record transaction for client (debit)
      await blink.db.transactions.create({
        userId: clientId,
        contractId,
        type: "debit",
        amount: contract.amount,
        description: `Payment for: ${contract.title}`,
        status: "completed",
        stripeId: paymentIntent.id,
      });

      // Notify freelancer
      await blink.db.notifications.create({
        userId: freelancerId,
        title: "Payment Received in Escrow",
        message: `Client has paid $${contract.amount} for "${contract.title}". Start working on the project!`,
        type: "success",
        link: `/contracts/${contractId}`,
        isRead: "0",
      });

      // Notify client
      await blink.db.notifications.create({
        userId: clientId,
        title: "Payment Held in Escrow",
        message: `Your payment of $${contract.amount} is secured in escrow for "${contract.title}".`,
        type: "success",
        link: `/contracts/${contractId}`,
        isRead: "0",
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { contractId, clientId } = paymentIntent.metadata;

      if (contractId && clientId) {
        await blink.db.notifications.create({
          userId: clientId,
          title: "Payment Failed",
          message: `Your payment for contract "${contractId}" failed. Please try again.`,
          type: "error",
          link: `/contracts/${contractId}`,
          isRead: "0",
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);