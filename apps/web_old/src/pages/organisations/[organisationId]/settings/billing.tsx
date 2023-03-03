import LayoutApp from "@/components/layout/LayoutApp";
import BillingPage from "@/components/settings/BillingPage";

export default function Billing({}) {
  if (process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1") {
    return <div>Not available</div>;
  }
  return (
    <LayoutApp>
      <BillingPage />
    </LayoutApp>
  );
}
