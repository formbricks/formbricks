interface PendingDowngradeBannerProps {
  lastChecked: Date;
  active: boolean;
  isPendingDowngrade: boolean;
}

export const PendingDowngradeBanner = ({
  lastChecked,
  active,
  isPendingDowngrade,
}: PendingDowngradeBannerProps) => {
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;

  const isLastCheckedWithin72Hours = lastChecked
    ? new Date().getTime() - lastChecked.getTime() < threeDaysInMillis
    : false;

  const scheduledDowngradeDate = new Date(lastChecked.getTime() + threeDaysInMillis);

  if (active) {
    if (isPendingDowngrade && isLastCheckedWithin72Hours) {
      return (
        <>
          <div className="z-40 flex h-5 items-center justify-center bg-orange-800 text-center text-xs text-white">
            We were unable to verify your license because the license server is unreachable. You will be
            downgraded to the Community Edition on {scheduledDowngradeDate.toLocaleDateString()}
          </div>
        </>
      );
    }
  }

  if (isPendingDowngrade && !isLastCheckedWithin72Hours) {
    return (
      <>
        <div className="z-40 flex h-5 items-center justify-center bg-orange-800 text-center text-xs text-white">
          We were unable to verify your license because the license server is unreachable. You are downgraded
          to the Community Edition.
        </div>
      </>
    );
  }

  return null;
};
