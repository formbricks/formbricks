export const ArrowRightCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <circle cx={12} cy={12} r={9.5} fill="#00e6ca" />
      <path
        d="M1.414,16.5a11.5,11.5,0,1,0,0-9"
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="12.5 16 16.5 12 12.5 8"
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={16.5}
        y1={12}
        x2={0.5}
        y2={12}
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
