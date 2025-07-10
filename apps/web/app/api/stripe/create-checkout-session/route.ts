import { STRIPE_API_VERSION, WEBAPP_URL } from "@/lib/constants";
import { env } from "@/lib/env";
import { getSurvey } from "@/lib/survey/service";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = "USD",
      paymentType = "one-time",
      environmentId,
      surveyId,
      questionId,
      collectBillingAddress = false,
      collectShippingAddress = false,
      allowPromotionCodes = false,
      subscriptionData,
      successUrl,
      cancelUrl,
    } = body;

    if (!env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    if (!surveyId || !questionId || !environmentId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify the survey exists and the question is valid
    const survey = await getSurvey(surveyId);
    if (!survey || survey.environmentId !== environmentId) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    const question = survey.questions.find((q) => q.id === questionId);
    if (!question || question.type !== "payment") {
      return NextResponse.json(
        { error: "Payment question not found" },
        { status: 404 }
      );
    }

    // Create checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: paymentType === "subscription" ? "subscription" : "payment",
      success_url: successUrl || `${WEBAPP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${WEBAPP_URL}/payment-cancelled`,
      metadata: {
        surveyId,
        questionId,
        environmentId,
        paymentType,
      },
      billing_address_collection: collectBillingAddress ? "required" : "auto",
      shipping_address_collection: collectShippingAddress ? {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI"],
      } : undefined,
      allow_promotion_codes: allowPromotionCodes,
      automatic_tax: { enabled: true },
    };

    if (paymentType === "subscription" && subscriptionData) {
      // For subscriptions, create a price first
      const price = await stripe.prices.create({
        unit_amount: amount,
        currency: currency.toLowerCase(),
        recurring: {
          interval: subscriptionData.interval || "month",
          interval_count: subscriptionData.intervalCount || 1,
        },
        product_data: {
          name: `Survey Payment - ${survey.name}`,
          description: `Payment for survey: ${survey.name}`,
        },
      });

      sessionParams.line_items = [
        {
          price: price.id,
          quantity: 1,
        },
      ];

      if (subscriptionData.trialPeriodDays) {
        sessionParams.subscription_data = {
          trial_period_days: subscriptionData.trialPeriodDays,
        };
      }
    } else {
      // For one-time payments
      sessionParams.line_items = [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amount,
            product_data: {
              name: `Survey Payment - ${survey.name}`,
              description: `Payment for survey: ${survey.name}`,
            },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    logger.error(error, "Error creating Stripe checkout session");
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}