export function CrossMarkIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <defs />
      <circle cx={12} cy={12} r={11} fill="#c4f0eb" />
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
}
