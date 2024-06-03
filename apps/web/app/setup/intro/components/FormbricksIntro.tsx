import React from "react";

import { Button } from "@formbricks/ui/Button";

export const FormbricksIntro = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <h2 className="text-2xl font-medium">Welcome to Formbricks!</h2>
      <p>
        Formbricks is a versatile open source platform with an Experience Management Suite built on top of it.
      </p>
      <p>Survey customers, users or employees at any points with a perfectly timed and targeted survey.</p>
      <p>Keep full control over your data</p>
      <div>
        <Button variant="darkCTA" href="/setup/signup">
          Get started
        </Button>
      </div>
      <p>Made with 🤍 in Kiel, Germany</p>
    </div>
  );
};
