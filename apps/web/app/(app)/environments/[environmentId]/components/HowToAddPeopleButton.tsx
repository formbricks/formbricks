import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";

import { Button } from "@formbricks/ui/Button";

export default function HowToAddPeopleButton() {
  return (
    <Button variant="secondary" href="https://formbricks.com/docs/attributes/identify-users" target="_blank">
      <QuestionMarkCircleIcon className="mr-2 h-4 w-4" />
      How to add people
    </Button>
  );
}
