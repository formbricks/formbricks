import { h, VNode } from "preact";
import { useEffect, useState } from "preact/compat";
import { clsx } from "../lib/utils";

export default function Modal({ children }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(true);
  }, []);
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        <div
          className={clsx(
            loaded ? "translate-x-0 opacity-100" : "translate-x-28 opacity-0",
            "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out"
          )}>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
