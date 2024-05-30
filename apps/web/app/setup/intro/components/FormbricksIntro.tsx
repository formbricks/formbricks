import Link from "next/link";
import React from "react";

import { Button } from "@formbricks/ui/Button";
import { FormbricksLogo } from "@formbricks/ui/FormbricksLogo";

export const FormbricksIntro = () => {
  return (
    <div className="flex w-[40rem] flex-col items-center space-y-4 rounded-lg border bg-white p-20 text-center shadow">
      <FormbricksLogo className="h-20 w-20 rounded-lg bg-black p-2" />
      <h2 className="text-2xl font-medium">Welcome to Formbricks!</h2>
      <p>
        Formbricks is a versatile open source platform with an Experience Management Suite built on top of it.
      </p>
      <p>Survey customers, users or employee at any points with a perfectly timed and targeted survey.</p>
      <p>Keep full control over your data</p>

      <Link href="/setup/auth">
        <Button variant="darkCTA">Get started</Button>
      </Link>
      <p>Made with 🤍 in Kiel, Germany</p>
    </div>
  );
};
