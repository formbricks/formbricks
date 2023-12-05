export const dynamic = "force-dynamic";

import ConfirmationPage from "./components/ConfirmationPage";

export default function BillingConfirmation({ searchParams }) {
  const { environmentId } = searchParams;

  return <ConfirmationPage environmentId={environmentId?.toString()} />;
}
