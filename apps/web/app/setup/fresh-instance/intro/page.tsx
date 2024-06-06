import { Metadata } from "next";

import { Button } from "@formbricks/ui/Button";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">Welcome to Formbricks!</h2>
      <div className="space-y-4 text-sm text-slate-800">
        <p>
          Formbricks is a versatile open source platform with an Experience Management Suite built on top of
          it.
        </p>
        <p>Survey customers, users or employees at any points with a perfectly timed and targeted survey.</p>
        <p>Keep full control over your data</p>
      </div>
      <Button variant="darkCTA" href="/setup/fresh-instance/signup" className="mt-6">
        Get started
      </Button>

      <p className="pt-6 text-xs text-slate-500">Made with 🤍 in Kiel, Germany</p>
    </div>
  );
};

export default Page;
