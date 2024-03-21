import { Button } from "@formbricks/ui/Button";

export const EnterpriseEditionInfo = () => {
  return (
    <div className="my-8 md:my-6">
      <div className="md:px-16">
        <div className=" rounded-xl bg-slate-100 p-8 md:px-12 dark:bg-slate-800">
          <h2 className="text-lg font-semibold leading-7 tracking-tight text-slate-800 md:text-2xl dark:text-slate-200">
            Enterprise Edition (Self-hosting)
          </h2>

          <p className=" my-2 text-slate-600 dark:text-slate-300">
            All features which are not available in the Community Edition belong to the Formbricks Enterprise
            Edition. If you would like to use these features on a self-hosted instance, you need to purchase
            an Enterprise license from us.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="inline"
              variant="darkCTA"
              onClick={() => window.open("https://cal.com/johannes/license", "_blank")}>
              Talk to us
            </Button>
            <Button
              className="inline"
              onClick={() => window.open("/docs/self-hosting/enterprise", "_blank")}
              variant="secondary">
              More info on Enterprise Edition
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
