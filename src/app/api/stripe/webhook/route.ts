import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook Error: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;

    if (userId) {
      // Use Service Role Key to bypass RLS securely on the server
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_pro: true })
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile to pro:", error);
        return new NextResponse("Database Error", { status: 500 });
      }

      console.log(`Successfully upgraded user ${userId} to Pro!`);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
