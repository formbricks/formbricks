import { Button } from "@formbricks/ui";

declare global {
  interface Window {
    formbricks: any;
  }
}

export function FeedbackButton() {
  return <Button variant="secondary">Open Feedback</Button>;
}
