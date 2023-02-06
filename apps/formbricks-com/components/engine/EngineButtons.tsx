import { Button } from "@formbricks/ui";

interface EngineButtonsProps {
  allowSkip: boolean;
  skipAction: () => void;
  autoSubmit: boolean;
}

export function EngineButtons({ allowSkip, skipAction, autoSubmit }: EngineButtonsProps) {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-xl justify-end">
      {allowSkip && (
        <Button
          variant="secondary"
          type="button"
          className="transition-all ease-in-out hover:scale-105"
          onClick={() => skipAction()}>
          Skip
        </Button>
      )}
      {!autoSubmit && (
        <Button variant="primary" type="submit" className="ml-2 transition-all ease-in-out hover:scale-105">
          Next
        </Button>
      )}
    </div>
  );
}
