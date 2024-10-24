import { useTranslations } from "next-intl";
import { TEnvironment } from "@formbricks/types/environment";

interface DevEnvironmentBannerProps {
  environment: TEnvironment;
}

export const DevEnvironmentBanner = ({ environment }: DevEnvironmentBannerProps) => {
  const t = useTranslations();
  return (
    <>
      {environment.type === "development" && (
        <div className="z-40 flex h-5 items-center justify-center bg-orange-800 text-center text-xs text-white">
          {t("common.development_environment_banner")}
        </div>
      )}
    </>
  );
};
