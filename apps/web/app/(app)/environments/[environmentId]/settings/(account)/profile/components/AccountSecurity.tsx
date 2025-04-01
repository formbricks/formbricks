"use client";

import { TUser } from "@formbricks/types/user";

interface AccountSecurityProps {
  user: TUser;
}

export const AccountSecurity = ({ user }: AccountSecurityProps) => {
  return (
    <div>
      <div className="flex items-center space-x-4"></div>
    </div>
  );
};
