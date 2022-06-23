import React from "react";
import { classNames } from "../../lib/utils";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  [key: string]: any;
}

// button component, consuming props
const SecondNavBar: React.FC<Props> = ({
  children,
  onClick = () => {},
  ...rest
}) => {
  return (
    <div className="relative z-10 flex flex-shrink-0 h-16 py-2 bg-ui-gray-lighter">
      <div className="flex items-center justify-center flex-1 px-4 py-2">
        <nav className="flex space-x-4" aria-label="resultModes">
          {children}
        </nav>
      </div>
    </div>
  );
};

export default SecondNavBar;
