import { TEnvironment } from "@formbricks/types/environment";

interface DevEnvironmentBannerProps {
  environment: TEnvironment;
}

export const DevEnvironmentBanner = ({ environment }: DevEnvironmentBannerProps) => {
  return (
    <>
      {environment.type === "development" && (
        <div className="items-center justify-center bg-orange-800 p-1 text-center text-xs text-white">
          You&apos;re in an development environment. Set it up to test surveys, actions and attributes.
        </div>
      )}
    </>
  );
};
