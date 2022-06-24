import React from "react";

interface Props {
  children: React.ReactNode;
}

// button component, consuming props
const SecondNavBar: React.FC<Props> = ({ children }) => {
  return (
    <div className="relative flex flex-shrink-0 h-16 py-2 border-b border-ui-gray-light bg-ui-gray-lighter">
      <div className="flex items-center justify-center flex-1 px-4 py-2">
        <nav className="flex space-x-4" aria-label="resultModes">
          {children}
        </nav>
      </div>
    </div>
  );
};

export default SecondNavBar;
