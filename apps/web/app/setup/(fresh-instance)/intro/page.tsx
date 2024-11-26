import { Metadata } from "next";
import { Button } from "@formbricks/ui/Button";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = () => {
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">Welcome to Formbricks!</h2>
      <div className="mx-auto max-w-sm space-y-4 text-sm leading-6 text-slate-600">
        <p>
          Formbricks is an Experience Management Suite built of the{" "}
          <b>fastest growing open source survey platform</b> worldwide.
        </p>
        <p>
          Run targeted surveys on websites, in apps or anywhere online. Gather valuable insights to{" "}
          <b>craft irresistible experiences</b> for customers, users and employees.
        </p>
        <p>
          We&apos;re commited to highest degree of data privacy. Self-host to keep{" "}
          <b>full control over your data.</b> Always.
        </p>
      </div>
      <Button href="/setup/signup" className="mt-6">
        Get started
      </Button>

      <p className="pt-6 text-xs text-slate-400">Made with 🤍 in Kiel, Germany</p>
    </div>
  );
};

export default Page;
