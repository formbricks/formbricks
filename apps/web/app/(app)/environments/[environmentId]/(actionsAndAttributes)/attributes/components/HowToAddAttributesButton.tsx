import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";

import { Button } from "@formbricks/ui/Button";

export default function HowToAddAttributesButton() {
  return (
    <Button
      variant="secondary"
      href="http://formbricks.com/docs/attributes/custom-attributes"
      target="_blank">
      <QuestionMarkCircleIcon className="mr-2 h-4 w-4" />
      How to add attributes
    </Button>
  );
}
