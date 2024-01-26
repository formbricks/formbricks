export const CrossMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <line
        x1={23.5}
        y1={0.5}
        x2={0.5}
        y2={23.5}
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={23.5}
        y1={23.5}
        x2={0.5}
        y2={0.5}
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
