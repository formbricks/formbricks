import React from "react";

export const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <line x1="17" y1="17" x2="13.5" y2="13.5" />
    </svg>
  );
};
