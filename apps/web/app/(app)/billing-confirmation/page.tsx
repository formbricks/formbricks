import ConfirmationPage from "./components/ConfirmationPage";

export const dynamic = "force-dynamic";

export default function BillingConfirmation({ searchParams }) {
  const { environmentId } = searchParams;

  return <ConfirmationPage environmentId={environmentId?.toString()} />;
}
