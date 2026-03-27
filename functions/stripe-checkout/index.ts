import { createClient } from "npm:@blinkdotnew/sdk";
import Stripe from "npm:stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const envKey = ["STRIPE", "SECRET", "KEY"].join("_");
    const stripeKey = Deno.env.get(envKey);
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!stripeKey || !projectId || !secretKey) {
      return new Response(JSON.stringify({ error: "Missing config. Please add STRIPE_SECRET_KEY to environment variables." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const blink = createClient({ projectId, secretKey });

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractId } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "contractId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contract
    const contract = await blink.db.contracts.get(contractId);
    if (!contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contract.clientId !== auth.userId) {
      return new Response(JSON.stringify({ error: "Not authorized for this contract" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client profile for Stripe customer
    const profiles = await blink.db.userProfiles.list({ where: { userId: auth.userId }, limit: 1 });
    const _profile = profiles[0];

    // Amount in cents
    const amountCents = Math.round(contract.amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      metadata: {
        contractId: contract.id,
        clientId: contract.clientId,
        freelancerId: contract.userId,
      },
      description: `FreelanceHub Escrow: ${contract.title}`,
    });

    // Update contract with payment intent ID
    await blink.db.contracts.update(contractId, {
      stripePaymentIntentId: paymentIntent.id,
    });

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: contract.amount,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);