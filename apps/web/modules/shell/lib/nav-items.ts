export type ShellNavIcon = "plug" | "key" | "building" | "user";

export interface ShellNavItem {
  id: "connect" | "connections" | "organization" | "account";
  href: string;
  label: string;
  icon: ShellNavIcon;
  /** Path prefixes that mark this item as the current section. */
  matchPrefixes: string[];
}

interface NavLabels {
  connect: string;
  connections: string;
  organization: string;
  account: string;
}

/**
 * The sidebar sections. The billing role is a finance seat: it can reach billing and its own
 * account, nothing that touches agents or people.
 */
export const getShellNavItems = ({
  organizationId,
  isBilling,
  labels,
}: {
  organizationId: string;
  isBilling: boolean;
  labels: NavLabels;
}): ShellNavItem[] => {
  const base = `/organizations/${organizationId}`;
  const organization: ShellNavItem = {
    id: "organization",
    href: isBilling ? `${base}/billing` : `${base}/members`,
    label: labels.organization,
    icon: "building",
    matchPrefixes: [
      `${base}/members`,
      `${base}/teams`,
      `${base}/workspaces`,
      `${base}/security`,
      `${base}/billing`,
    ],
  };
  const account: ShellNavItem = {
    id: "account",
    href: "/account",
    label: labels.account,
    icon: "user",
    matchPrefixes: ["/account"],
  };

  if (isBilling) {
    return [organization, account];
  }

  return [
    { id: "connect", href: base, label: labels.connect, icon: "plug", matchPrefixes: [] },
    {
      id: "connections",
      href: `${base}/connections`,
      label: labels.connections,
      icon: "key",
      matchPrefixes: [`${base}/connections`],
    },
    organization,
    account,
  ];
};

/** `connect` lives at the organization root, so it matches exactly; the rest match by prefix. */
export const isNavItemActive = (item: ShellNavItem, pathname: string, organizationId: string): boolean => {
  if (item.id === "connect") {
    return pathname === `/organizations/${organizationId}`;
  }
  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};
