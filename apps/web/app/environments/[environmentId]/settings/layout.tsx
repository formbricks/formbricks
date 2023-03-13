import SettingsNavbar from "@/components/settings/SettingsNavbar";

export default function SettingsLayout({ children, title, params }) {
  return (
    <>
      <div className="flex">
        <SettingsNavbar environmentId={params.environmentId} />
        <div className="ml-64 w-full">
          <div className="max-w-4xl p-6">
            <h3>{title}</h3>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
