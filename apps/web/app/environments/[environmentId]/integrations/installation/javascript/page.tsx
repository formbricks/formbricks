import DocsSidebar from "@/components/integrations/DocsSidebar";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import JSLogo from "@/images/jslogo.png";
import { Input } from "@formbricks/ui";
import Image from "next/image";

export default function JavaScriptPage({ params }) {
  /*   useEffect(() => {
    Prism.highlightAll();
  }, []); */

  return (
    <div>
      <IntegrationPageTitle
        environmentId={params.environmentId}
        title="JavaScript Snippet"
        icon={<Image src={JSLogo} alt="JavaScript Logo" />}
        goBackTo="installation"
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
            <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-slate-200">
              <pre>
                <code className="language-html whitespace-pre-wrap">
                  {`<!--HTML header script -->
<script src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.2" defer></script>

<script>
  window.formbricks = {
      ...window.formbricks,
      config: {
        hqUrl: "https://app.formbricks.com",
        formId: "YOUR FEEDBACK BOX ID HERE", // copy from Formbricks dashboard
        contact: {
          name: "Matti",
          position: "Co-Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
      },
    }
    </script>
`}
                </code>
              </pre>
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <DocsSidebar />
        </div>
      </div>
    </div>
  );
}
