import { TOrganization } from "@formbricks/types/organizations";

interface LimitsReachedBannerProps {
  organization: TOrganization;
  peopleCount: number;
  responseCount: number;
}

export const LimitsReachedBanner = ({
  organization,
  peopleCount,
  responseCount,
}: LimitsReachedBannerProps) => {
  const orgBillingPeopleLimit = organization.billing?.limits?.monthly?.miu;
  const orgBillingResponseLimit = organization.billing?.limits?.monthly?.responses;

  const isPeopleLimitReached = peopleCount >= orgBillingPeopleLimit;
  const isResponseLimitReached = responseCount >= orgBillingResponseLimit;

  if (isPeopleLimitReached && isResponseLimitReached) {
    return (
      <>
        <div className="z-40 flex h-5 items-center justify-center bg-orange-800 text-center text-xs text-white">
          You have reached your monthly active people limit of {orgBillingPeopleLimit} and response limit of{" "}
          {orgBillingResponseLimit}. Please upgrade your plan to continue.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="z-40 flex h-5 items-center justify-center bg-orange-800 text-center text-xs text-white">
        {isPeopleLimitReached && (
          <div>
            You have reached your monthly active people limit of {orgBillingPeopleLimit}. Please upgrade your
            plan to continue.
          </div>
        )}
        {isResponseLimitReached && (
          <div>
            You have reached your monthly response limit of {orgBillingResponseLimit}. Please upgrade your
            plan to continue.
          </div>
        )}
      </div>
    </>
  );
};
