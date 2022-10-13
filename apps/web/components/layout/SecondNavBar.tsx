import React from "react";
import { classNames } from "../../lib/utils";

interface NavItem {
  id: string;
  onClick: () => void;
  Icon?: React.ElementType;
  label?: string;
  disabled?: boolean;
}

interface Props {
  navItems: NavItem[];
  currentItemId?: string;
}

// button component, consuming props
const SecondNavBar: React.FC<Props> = ({ navItems, currentItemId }) => {
  return (
    <div className="border-ui-gray-light bg-ui-gray-lighter flex flex-shrink-0 items-center justify-center border-b">
      <nav className="flex space-x-10" aria-label="resultModes">
        {navItems.map((navItem) => (
          <button
            key={navItem.id}
            className={classNames(
              `h-16 border-b-2 border-transparent text-xs`,
              !navItem.disabled &&
                (navItem.id === currentItemId
                  ? "text-red border-red border-b-2"
                  : "text-ui-gray-dark hover:text-red bg-transparent hover:border-gray-300"),
              navItem.disabled
                ? "text-ui-gray-medium"
                : "hover:border-red text-ui-gray-dark hover:text-red hover:border-b-2"
            )}
            onClick={navItem.onClick}
            disabled={navItem.disabled}>
            {navItem.Icon && <navItem.Icon className="mx-auto mb-1 h-6 w-6 stroke-1" />}
            {navItem.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default SecondNavBar;
