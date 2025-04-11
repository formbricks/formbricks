import { useEffect, useState } from "react";

const REDIRECT_TIMEOUT = 5;

interface RedirectCountDownProps {
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
}

export function RedirectCountDown({ redirectUrl, isRedirectDisabled }: RedirectCountDownProps) {
  const [timeRemaining, setTimeRemaining] = useState(REDIRECT_TIMEOUT);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (redirectUrl) {
      interval = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 0) {
            clearInterval(interval);
            if (!isRedirectDisabled) {
              window.top?.location.replace(redirectUrl);
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    // Clean up the interval when the component is unmounted
    return () => {
      clearInterval(interval);
    };
  }, [redirectUrl, isRedirectDisabled]);

  if (!redirectUrl) return null;

  return (
    <div>
      <div className="bg-accent-bg text-subheading mt-10 rounded-md p-2 text-sm">
        <span>You&apos;re redirected in </span>
        <span>{timeRemaining}</span>
      </div>
    </div>
  );
}
