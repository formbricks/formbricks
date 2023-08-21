import SettingsNavbar from "./SettingsNavbar";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsLayout({ children, params }) {
  return (
    <>
      <div className="sm:flex">
        <SettingsNavbar environmentId={params.environmentId} />
        <div className="w-full sm:ml-64">
          <div className="max-w-4xl px-6 pb-6 pt-14 sm:pt-6">
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
