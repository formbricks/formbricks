import { Button } from "@formbricks/ui";
import Link from "next/link";

export default function ProjectsPage() {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">Dashboard</h1>
      <div className="max-w-3xl bg-white shadow sm:rounded-lg">
        <div className="mt-8 px-4 py-5 sm:p-6 ">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Welcome to Formbricks HQ</h3>
          <div className="mt-2 text-sm text-gray-500">
            <p>
              Formbricks HQ is your backend for Form & Survey Data. Collect data from any form, store and
              analyze it in Formbricks HQ or pipe it to third party services.
              <br />
              <br />
              To get started read the docs first or go directly to your account settings to create a new
              personal API Key.
            </p>
          </div>
          <div className="mt-5">
            <Button variant="secondary" href="/app/me/settings">
              Create API Key
            </Button>
            <Button className="ml-3" href="https://formbricks.com/docs">
              Read the Docs
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
