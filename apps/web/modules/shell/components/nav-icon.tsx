import { Building2Icon, KeyRoundIcon, PlugIcon, UserIcon } from "lucide-react";
import type { ShellNavIcon } from "../lib/nav-items";

const icons = {
  plug: PlugIcon,
  key: KeyRoundIcon,
  building: Building2Icon,
  user: UserIcon,
} as const;

export const NavIcon = ({ name }: Readonly<{ name: ShellNavIcon }>) => {
  const Icon = icons[name];
  return <Icon className="size-4 shrink-0" aria-hidden="true" />;
};
