"use client";

import { AlertJakob } from "@/modules/ui/components/jakob";
import React from "react";

export default function YourClientPage() {
  const handleLearnMore = () => {
    alert("Learn more");
  };

  return (
    <div>
      <AlertJakob
        variant="info"
        size="small"
        title="Inconsistent Response Data"
        className="w-fit"
        button={{
          label: "Learn more",
          onClick: handleLearnMore,
        }}
      />
    </div>
  );
}
