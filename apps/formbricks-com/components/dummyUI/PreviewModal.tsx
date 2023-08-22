import clsx from "clsx";
import { ReactNode, useEffect, useState } from "react";

export const Modal: React.FC<{ children: ReactNode; isOpen: boolean }> = ({ children, isOpen }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none absolute inset-0 flex items-end px-4 py-6 sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        <div
          className={clsx(
            show ? "translate-x-0 opacity-100" : "translate-x-28 opacity-0",
            "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out sm:p-6"
          )}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
