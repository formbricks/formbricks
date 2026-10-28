/** The "or" rule between the password form and the single sign-on buttons. */
export const AuthDivider = ({ label }: Readonly<{ label: string }>) => (
  <div className="flex items-center gap-3 text-xs text-slate-500" role="separator">
    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    {label}
    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
  </div>
);
