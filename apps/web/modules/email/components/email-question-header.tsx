import { Text } from "@react-email/components";
import { cn } from "@formbricks/lib/cn";

interface QuestionHeaderProps {
  headline: string;
  subheader?: string;
  className?: string;
}

export function QuestionHeader({ headline, subheader, className }: QuestionHeaderProps): React.JSX.Element {
  return (
    <>
      <Text className={cn("text-question-color m-0 block text-base font-semibold leading-6", className)}>
        {headline}
      </Text>
      {subheader && (
        <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">{subheader}</Text>
      )}
    </>
  );
}
