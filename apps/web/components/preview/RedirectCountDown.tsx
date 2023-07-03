import React from "react";
import { useEffect, useState } from "react";

export default function RedirectCountDown({ initiateCountdown }: { initiateCountdown: boolean | undefined }) {
  const [timeRemaining, setTimeRemaining] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prevTime) => prevTime - 1);
    }, 1000);

    if (timeRemaining === 0) {
      clearInterval(interval);
    }

    // Clean up the interval when the component is unmounted
    return () => clearInterval(interval);
  }, [timeRemaining]);

  return (
    <div>
      {initiateCountdown && (
        <div className="mt-10 rounded-md bg-slate-100 p-2 text-sm">
          <span>You&apos;re redirected in </span>
          <span>{timeRemaining}</span>
        </div>
      )}
    </div>
  );
}
