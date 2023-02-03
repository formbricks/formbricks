import PricingTable from "@formbricks/ee/billing/components/PricingTable";
import Modal from "./Modal";

export default function UpgradeModal({ open, setOpen, organisationId }) {
  return (
    <Modal open={open} setOpen={setOpen}>
      <div className="my-6 sm:flex-auto">
        <h1 className="text-xl font-semibold text-gray-900">Upgrade to benefit from all features</h1>
        <p className="mt-2 text-sm text-gray-700">
          You do not currently have an active subscription. Upgrade to get access to all features and improve
          your user research.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg">
        <PricingTable organisationId={organisationId} />
      </div>
    </Modal>
  );
}
