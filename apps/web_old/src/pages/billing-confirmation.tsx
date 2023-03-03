import LayoutApp from "@/components/layout/LayoutApp";
import { Button, Confetti } from "@formbricks/ui";

export default function Billing({}) {
  if (process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1") {
    return <div>Not available</div>;
  }
  return (
    <LayoutApp>
      <Confetti />
      <div className="mx-auto max-w-sm py-8 sm:px-6 lg:px-8">
        <div className="my-6 sm:flex-auto">
          <h1 className="text-center text-xl font-semibold text-slate-900">Upgrade successful</h1>
          <p className="mt-2 text-center text-sm text-slate-700">
            Thanks a lot for upgrading your formbricks subscription. You can now access all features and
            improve your user research.
          </p>
        </div>
        <Button className="w-full justify-center" href="/">
          Got to my forms
        </Button>
      </div>
    </LayoutApp>
  );
}
