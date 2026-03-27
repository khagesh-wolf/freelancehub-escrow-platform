import { createClient } from "npm:@blinkdotnew/sdk";

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
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blink = createClient({ projectId, secretKey });

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const profiles = await blink.db.userProfiles.list({ where: { userId: auth.userId }, limit: 1 });
    const adminProfile = profiles[0];
    if (!adminProfile || adminProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractId, adminNotes } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "contractId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contract = await blink.db.contracts.get(contractId);
    if (!contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contract.paymentStatus !== "paid_to_platform") {
      return new Response(JSON.stringify({ error: "Payment not in escrow" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const freelancerAmount = contract.freelancerAmount || (contract.amount * 0.9);

    // Update contract
    await blink.db.contracts.update(contractId, {
      status: "completed",
      paymentStatus: "released",
      adminNotes: adminNotes || "Payment released by admin",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update freelancer wallet — get or create
    const wallets = await blink.db.wallets.list({ where: { userId: contract.userId }, limit: 1 });
    if (wallets.length > 0) {
      const wallet = wallets[0];
      await blink.db.wallets.update(wallet.id, {
        balance: (Number(wallet.balance) || 0) + freelancerAmount,
        totalEarned: (Number(wallet.totalEarned) || 0) + freelancerAmount,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await blink.db.wallets.create({
        userId: contract.userId,
        balance: freelancerAmount,
        pendingBalance: 0,
        totalEarned: freelancerAmount,
        totalWithdrawn: 0,
      });
    }

    // Update freelancer profile earnings
    const freelancerProfiles = await blink.db.freelancerProfiles.list({ where: { userId: contract.userId }, limit: 1 });
    if (freelancerProfiles.length > 0) {
      const fp = freelancerProfiles[0];
      await blink.db.freelancerProfiles.update(fp.id, {
        totalEarnings: (Number(fp.totalEarnings) || 0) + freelancerAmount,
        completedJobs: (Number(fp.completedJobs) || 0) + 1,
      });
    }

    // Transaction record for freelancer
    await blink.db.transactions.create({
      userId: contract.userId,
      contractId,
      type: "credit",
      amount: freelancerAmount,
      description: `Payment released: ${contract.title}`,
      status: "completed",
      stripeId: contract.stripePaymentIntentId || "",
    });

    // Notify freelancer
    await blink.db.notifications.create({
      userId: contract.userId,
      title: "Payment Released! 🎉",
      message: `$${freelancerAmount.toFixed(2)} has been added to your wallet for "${contract.title}".`,
      type: "success",
      link: "/wallet",
      isRead: "0",
    });

    // Notify client
    await blink.db.notifications.create({
      userId: contract.clientId,
      title: "Project Completed",
      message: `Your project "${contract.title}" is marked complete. Payment has been released to the freelancer.`,
      type: "success",
      link: `/contracts/${contractId}`,
      isRead: "0",
    });

    return new Response(JSON.stringify({ success: true, amountReleased: freelancerAmount }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Release payment error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
