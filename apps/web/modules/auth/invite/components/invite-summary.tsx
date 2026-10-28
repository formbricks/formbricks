/** Who is inviting to what: the organization's initial, its name and the role on offer. */
export const InviteSummary = ({
  organizationName,
  roleLabel,
}: Readonly<{ organizationName: string; roleLabel: string }>) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
    <span
      aria-hidden="true"
      className="flex size-9 flex-none items-center justify-center rounded-md bg-slate-900 font-semibold text-white">
      {organizationName.trim().charAt(0).toUpperCase()}
    </span>
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-800">{organizationName}</p>
      <p className="text-[13px] text-slate-500">{roleLabel}</p>
    </div>
  </div>
);
