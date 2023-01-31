import Script from "next/script";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ["stripe-pricing-table"]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export default function BillingPage() {
  if (!process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID || !process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) {
    return null;
  }

  return (
    <>
      <Script async src="https://js.stripe.com/v3/pricing-table.js" />
      <stripe-pricing-table
        pricing-table-id={process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID}
        publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY}></stripe-pricing-table>
    </>
  );
}
