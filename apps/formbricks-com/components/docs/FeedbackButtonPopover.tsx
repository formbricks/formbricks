import { Button } from "@formbricks/ui";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    formbricks: any;
  }
}

export function FeedbackButton() {
  useEffect(() => {
    window.formbricks = {
      ...window.formbricks,
      config: {
        hqUrl: process.env.NEXT_PUBLIC_FORMBRICKS_URL,
        formId: process.env.NEXT_PUBLIC_FORMBRICKS_FORM_ID,
        contact: {
          name: "Matti",
          position: "Co-Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
      },
    };
    // @ts-ignore
    import("@formbricks/feedback");
  }, []);

  return (
    <Button variant="secondary" onClick={(e) => window.formbricks.open(e)}>
      Open Feedback
    </Button>
  );
}
