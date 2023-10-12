export const CheckMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <circle cx={12} cy={12} r={12} fill="#c4f0eb" />
      <polyline
        points="23.5 0.499 7 23.499 0.5 16.999"
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
