export const DoorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <title>{"architecture-door"}</title>
      <path d="M5,20.5V1.5a1,1,0,0,1,1-1H18a1,1,0,0,1,1,1v19Z" fill="#00e6ca" />
      <path d="M18,.5H6a1,1,0,0,0-1,1v3a1,1,0,0,1,1-1H18a1,1,0,0,1,1,1v-3A1,1,0,0,0,18,.5Z" fill="#00e6ca" />
      <circle
        cx={15.501}
        cy={11}
        r={1.5}
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#00e6ca"
      />
      <path
        d="M5,20.5V1.5a1,1,0,0,1,1-1H18a1,1,0,0,1,1,1v19"
        fill="none"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21,21.5a1,1,0,0,0-1-1H4a1,1,0,0,0-1,1V23a.5.5,0,0,0,.5.5h17A.5.5,0,0,0,21,23Z"
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#00e6ca"
      />
    </svg>
  );
};
