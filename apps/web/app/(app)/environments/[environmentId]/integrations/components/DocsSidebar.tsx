import { Button } from "@formbricks/ui/Button";

export const DocsSidebar = () => {
  return (
    <div className="w-20 min-w-max rounded-lg border border-slate-200 bg-slate-100 p-8">
      <p className="font-bold text-slate-700">Documentation</p>
      <p className="text-xs text-slate-500">Get detailed instructions</p>
      <Button className="my-2" href="https://formbricks.com/docs" target="_blank">
        Read Docs
      </Button>
      <p className="mt-6 font-bold text-slate-700">Need help?</p>
      <p className="text-xs text-slate-500">We&apos;re happy to help.</p>
      <Button className="my-2" variant="secondary" href="https://formbricks.com/discord" target="_blank">
        Join Discord
      </Button>
    </div>
  );
};
