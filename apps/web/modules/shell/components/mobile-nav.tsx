"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/modules/ui/components/logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/modules/ui/components/sheet";
import type { ShellNavItem } from "../lib/nav-items";
import { OrgSwitcher } from "./org-switcher";
import { ShellNavLinks } from "./shell-nav-links";

interface MobileNavProps {
  items: ShellNavItem[];
  organization: { id: string; name: string };
  organizations: { id: string; name: string }[];
  user: { name: string; email: string };
  labels: { openMenu: string; navigation: string; switchOrganization: string };
}

export const MobileNav = ({ items, organization, organizations, user, labels }: Readonly<MobileNavProps>) => {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 md:hidden">
      <Logo className="w-32" />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={labels.openMenu}
            className="flex size-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus">
            <MenuIcon className="size-5" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-72 flex-col gap-4 bg-slate-50">
          <SheetTitle className="sr-only">{labels.navigation}</SheetTitle>
          <SheetDescription className="sr-only">{organization.name}</SheetDescription>
          <OrgSwitcher
            organization={organization}
            organizations={organizations}
            switchLabel={labels.switchOrganization}
          />
          <ShellNavLinks
            items={items}
            organizationId={organization.id}
            ariaLabel={labels.navigation}
            onNavigate={() => setOpen(false)}
          />
          <div className="mt-auto flex flex-col border-t border-slate-200 p-2.5 text-sm">
            <span className="font-medium text-slate-800">{user.name}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};
