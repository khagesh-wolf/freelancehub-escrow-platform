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

    const authHeader = req.headers.get("Authorization");
    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profiles = await blink.db.userProfiles.list({ where: { userId: auth.userId }, limit: 1 });
    const adminProfile = profiles[0];
    if (!adminProfile || adminProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { withdrawalId, action, adminNotes } = await req.json();
    if (!withdrawalId || !action) {
      return new Response(JSON.stringify({ error: "withdrawalId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const withdrawal = await blink.db.withdrawalRequests.get(withdrawalId);
    if (!withdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (withdrawal.status !== "pending") {
      return new Response(JSON.stringify({ error: "Already processed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      // Deduct from wallet
      const wallets = await blink.db.wallets.list({ where: { userId: withdrawal.userId }, limit: 1 });
      if (wallets.length > 0) {
        const wallet = wallets[0];
        const newBalance = Math.max(0, (Number(wallet.balance) || 0) - withdrawal.amount);
        await blink.db.wallets.update(wallet.id, {
          balance: newBalance,
          totalWithdrawn: (Number(wallet.totalWithdrawn) || 0) + withdrawal.amount,
          updatedAt: new Date().toISOString(),
        });
      }

      await blink.db.withdrawalRequests.update(withdrawalId, {
        status: "completed",
        adminNotes: adminNotes || "Approved",
        updatedAt: new Date().toISOString(),
      });

      await blink.db.transactions.create({
        userId: withdrawal.userId,
        contractId: "",
        type: "withdrawal",
        amount: withdrawal.amount,
        description: `Withdrawal processed via ${withdrawal.method}`,
        status: "completed",
        stripeId: "",
      });

      await blink.db.notifications.create({
        userId: withdrawal.userId,
        title: "Withdrawal Approved ✅",
        message: `Your withdrawal of $${withdrawal.amount} has been approved and processed.`,
        type: "success",
        link: "/wallet",
        isRead: "0",
      });
    } else if (action === "reject") {
      await blink.db.withdrawalRequests.update(withdrawalId, {
        status: "rejected",
        adminNotes: adminNotes || "Rejected",
        updatedAt: new Date().toISOString(),
      });

      await blink.db.notifications.create({
        userId: withdrawal.userId,
        title: "Withdrawal Rejected",
        message: `Your withdrawal of $${withdrawal.amount} was rejected. Reason: ${adminNotes || "See admin notes."}`,
        type: "error",
        link: "/wallet",
        isRead: "0",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process withdrawal error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
