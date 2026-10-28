"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface OrgSwitcherProps {
  organization: { id: string; name: string };
  organizations: { id: string; name: string }[];
  canCreateOrganization: boolean;
  createLabel: string;
  switchLabel: string;
}

const OrgInitial = ({ name }: Readonly<{ name: string }>) => (
  <span
    aria-hidden="true"
    className="flex size-6 flex-none items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
    {name.trim().charAt(0).toUpperCase()}
  </span>
);

export const OrgSwitcher = ({
  organization,
  organizations,
  canCreateOrganization,
  createLabel,
  switchLabel,
}: Readonly<OrgSwitcherProps>) => {
  const canSwitch = organizations.length > 1 || canCreateOrganization;

  const trigger = (
    <button
      type="button"
      aria-label={canSwitch ? switchLabel : undefined}
      disabled={!canSwitch}
      className={cn(
        "flex h-11 w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        !canSwitch && "cursor-default"
      )}>
      <OrgInitial name={organization.name} />
      <span className="min-w-0 flex-1 truncate">{organization.name}</span>
      {canSwitch && <ChevronsUpDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
    </button>
  );

  if (!canSwitch) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} asChild>
            <Link
              href={`/organizations/${org.id}`}
              aria-current={org.id === organization.id ? "true" : undefined}>
              <OrgInitial name={org.name} />
              <span className="ml-2 truncate">{org.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {canCreateOrganization && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/setup/organization/create">{createLabel}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
