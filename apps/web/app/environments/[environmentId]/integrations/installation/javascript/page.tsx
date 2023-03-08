import JSLogo from "@/images/jslogo.png";
import Image from "next/image";
import DocsSidebar from "@/components/integrations/DocsSidebar";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import { Input } from "@/components/ui/Input";

export default function JavaScriptPage({}) {
  return (
    <div>
      <IntegrationPageTitle
        title="JavaScript Snippet"
        icon={<Image src={JSLogo} alt="JavaScript Logo" />}
        environmentId="my-environment-id"
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div>
            <h3 className="text-xl font-bold  text-slate-800">Quick Start</h3>
            <ol className="my-4 ml-2 list-decimal text-slate-900">
              <li>Copy the Javascript snippet below into the HEAD of your HTML file.</li>
              <li>Set up a button with the onClick handler below to let your users open the widget.</li>
              <li>PLACEHOLDER</li>
            </ol>
            <div className="flex">
              <div className="mr-6">
                <p className="font-bold text-slate-600">Production ID</p>
                <Input type="text" className="rounded border border-slate-200 bg-slate-100" />
              </div>
              <div>
                <p className="font-bold text-slate-600">Development ID</p>
                <Input type="text" className="rounded border border-slate-200 bg-slate-100" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="mt-12 text-xl font-bold text-slate-800">JavaScript Snippet</h3>
          </div>
        </div>
        <div className="col-span-1">
          <DocsSidebar />
        </div>
      </div>
    </div>
  );
}
