"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@formbricks/ui/Button";

export const SubmitButton = () => {
  const formStatus = useFormStatus();

  return (
    <Button type="submit" variant="darkCTA" size="sm" loading={formStatus.pending}>
      Update
    </Button>
  );
};
