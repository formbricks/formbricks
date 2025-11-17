interface SatisfactionSmileyProps {
  percentage: number;
  className?: string;
}

const TiredFace = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g id="line">
      <circle
        cx="36"
        cy="36"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        strokeWidth="2"
        d="m21.88 23.92c5.102-0.06134 7.273-1.882 8.383-3.346"
      />
      <path
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="2"
        d="m46.24 47.56c0-2.592-2.867-7.121-10.25-6.93-6.974 0.1812-10.22 4.518-10.22 7.111s4.271-1.611 10.05-1.492c6.317 0.13 10.43 3.903 10.43 1.311z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        strokeWidth="2"
        d="m23.16 28.47c5.215 1.438 5.603 0.9096 8.204 1.207 1.068 0.1221-2.03 2.67-7.282 4.397"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        strokeWidth="2"
        d="m50.12 23.92c-5.102-0.06134-7.273-1.882-8.383-3.346"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        strokeWidth="2"
        d="m48.84 28.47c-5.215 1.438-5.603 0.9096-8.204 1.207-1.068 0.1221 2.03 2.67 7.282 4.397"
      />
    </g>
  </svg>
);

const SlightlySmilingFace = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g id="line">
      <circle
        cx="36"
        cy="36"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M45.8149,44.9293 c-2.8995,1.6362-6.2482,2.5699-9.8149,2.5699s-6.9153-0.9336-9.8149-2.5699"
      />
      <path d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" />
      <path d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" />
    </g>
  </svg>
);

const GrinningSquintingFace = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g id="line">
      <circle
        cx="36"
        cy="36"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        points="25.168 27.413 31.755 31.427 25.168 35.165"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        points="46.832 27.413 40.245 31.427 46.832 35.165"
      />

      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M50.595,41.64a11.5554,11.5554,0,0,1-.87,4.49c-12.49,3.03-25.43.34-27.49-.13a11.4347,11.4347,0,0,1-.83-4.36h.11s14.8,3.59,28.89.07Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M49.7251,46.13c-1.79,4.27-6.35,7.23-13.69,7.23-7.41,0-12.03-3.03-13.8-7.36C24.2951,46.47,37.235,49.16,49.7251,46.13Z"
      />
    </g>
  </svg>
);

export const SatisfactionSmiley = ({ percentage, className }: SatisfactionSmileyProps) => {
  if (percentage > 80) {
    return <GrinningSquintingFace className={`h-4 w-4 text-emerald-500 ${className || ""}`} />;
  } else if (percentage >= 55) {
    return <SlightlySmilingFace className={`h-4 w-4 text-orange-500 ${className || ""}`} />;
  } else {
    return <TiredFace className={`h-4 w-4 text-rose-500 ${className || ""}`} />;
  }
};
