import SettingsNavbar from "./SettingsNavbar";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:"Settings"
}


export default function SettingsLayout({ children, params }) {
  return (
    <>
      <div className="flex">
        <SettingsNavbar environmentId={params.environmentId} />
        <div className="ml-64 w-full">
          <div className="max-w-4xl p-6">
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
