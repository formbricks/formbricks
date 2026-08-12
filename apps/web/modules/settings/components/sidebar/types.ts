import type { ReactNode } from "react";

// One entry of a settings sidebar nav section. `hidden` drops the item entirely (the viewer has no
// business seeing it), `disabled` keeps it visible but unclickable behind an explanatory tooltip.
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  hidden?: boolean;
  disabled?: boolean;
}
