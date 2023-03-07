import SettingsNavbar from "@/components/settings/SettingsNavbar";

export default async function SettingsLayout({ children, title, params }) {
  return (
    <>
      <div className="flex">
        <div className="">
          <SettingsNavbar environmentId={params.environmentId} />
        </div>
        <div className="w-full">
          <div className="p-6">
            <h3>{title}</h3>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
