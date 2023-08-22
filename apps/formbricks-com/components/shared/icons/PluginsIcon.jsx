import { DarkMode, Gradient, LightMode } from "@/components/shared/Icon";

export function PluginsIcon({ id, color }) {
  return (
    <>
      <defs>
        <Gradient id={`${id}-gradient`} color={color} gradientTransform="matrix(0 21 -21 0 20 11)" />
        <Gradient
          id={`${id}-gradient-dark-1`}
          color={color}
          gradientTransform="matrix(0 22.75 -22.75 0 16 6.25)"
        />
        <Gradient id={`${id}-gradient-dark-2`} color={color} gradientTransform="matrix(0 14 -14 0 16 10)" />
      </defs>
      <LightMode>
        <circle cx={20} cy={20} r={12} fill={`url(#${id}-gradient)`} />
        <g
          fillOpacity={0.5}
          className="fill-[var(--icon-background)] stroke-[color:var(--icon-foreground)]"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M3 9v14l12 6V15L3 9Z" />
          <path d="M27 9v14l-12 6V15l12-6Z" />
        </g>
        <path d="M11 4h8v2l6 3-10 6L5 9l6-3V4Z" fillOpacity={0.5} className="fill-[var(--icon-background)]" />
        <g
          className="stroke-[color:var(--icon-foreground)]"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M20 5.5 27 9l-12 6L3 9l7-3.5" />
          <path d="M20 5c0 1.105-2.239 2-5 2s-5-.895-5-2m10 0c0-1.105-2.239-2-5-2s-5 .895-5 2m10 0v3c0 1.105-2.239 2-5 2s-5-.895-5-2V5" />
        </g>
      </LightMode>
      <DarkMode strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M17.676 3.38a3.887 3.887 0 0 0-3.352 0l-9 4.288C3.907 8.342 3 9.806 3 11.416v9.168c0 1.61.907 3.073 2.324 3.748l9 4.288a3.887 3.887 0 0 0 3.352 0l9-4.288C28.093 23.657 29 22.194 29 20.584v-9.168c0-1.61-.907-3.074-2.324-3.748l-9-4.288Z"
          stroke={`url(#${id}-gradient-dark-1)`}
        />
        <path
          d="M16.406 8.087a.989.989 0 0 0-.812 0l-7 3.598A1.012 1.012 0 0 0 8 12.61v6.78c0 .4.233.762.594.925l7 3.598a.989.989 0 0 0 .812 0l7-3.598c.361-.163.594-.525.594-.925v-6.78c0-.4-.233-.762-.594-.925l-7-3.598Z"
          fill={`url(#${id}-gradient-dark-2)`}
          stroke={`url(#${id}-gradient-dark-2)`}
        />
      </DarkMode>
    </>
  );
}
