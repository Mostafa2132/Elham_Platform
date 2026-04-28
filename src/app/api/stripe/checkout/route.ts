import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { userId, email, locale } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing user data" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Elham Pro",
              description: "Unlock premium features, remove ads, and get the golden Pro badge.",
              images: ["https://cdn-icons-png.flaticon.com/512/3135/3135715.png"], // Temporary shiny star icon
            },
            unit_amount: 999, // $9.99
          },
          quantity: 1,
        },
      ],
      mode: "payment", // One-time payment
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${locale || "en"}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${locale || "en"}?canceled=true`,
      metadata: {
        userId,
      },
      customer_email: email,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
