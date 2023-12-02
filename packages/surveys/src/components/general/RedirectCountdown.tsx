import { useEffect, useState } from "preact/hooks";

const REDIRECT_TIMEOUT = 5;

interface RedirectCountDownProps {
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
}

export default function RedirectCountDown({ redirectUrl, isRedirectDisabled }: RedirectCountDownProps) {
  const [timeRemaining, setTimeRemaining] = useState(REDIRECT_TIMEOUT);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (redirectUrl) {
      const interval = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 0) {
            clearInterval(interval);
            if (!isRedirectDisabled) {
              var currentSearchParams = new URLSearchParams(window.location.search);
              var redirectUrlObject = new URL(redirectUrl);

              // Use forEach method to iterate over the search parameters
              currentSearchParams.forEach((value, key) => {
                redirectUrlObject.searchParams.set(key, value);
              });

              window.location.href = redirectUrlObject.toString();
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    // Clean up the interval when the component is unmounted
    return () => clearInterval(interval);
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
