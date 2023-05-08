export const ClockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <circle cx="{11.999}" cy="{12.001}" r="{11.5}" fill="#00e6ca" />
      <path d="M3.867,20.133A11.5,11.5,0,0,1,20.131,3.869Z" fill="#c4f0eb" />
      <circle
        cx="{11.999}"
        cy="{12.001}"
        r="{11.5}"
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="12 6.501 12 12.001 18 17.501" fill="none" stroke="#0f172a" strokeLinejoin="round" />
    </svg>
  );
};
