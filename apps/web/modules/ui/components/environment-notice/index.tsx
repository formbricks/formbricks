import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";

interface EnvironmentNoticeProps {
  environmentId: string;
  subPageUrl: string;
}

export const EnvironmentNotice = async (_props: EnvironmentNoticeProps) => {
  const t = await getTranslate();

  return (
    <div>
      <Alert variant="info" size="small" className="max-w-4xl">
        <AlertTitle>{t("common.environment_notice", { environment: t("common.production") })}</AlertTitle>
      </Alert>
    </div>
  );
};
