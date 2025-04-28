import { cn } from "@/lib/cn";
import { Text } from "@react-email/components";

interface QuestionHeaderProps {
  headline: string;
  subheader?: string;
  className?: string;
}

export function QuestionHeader({ headline, subheader, className }: QuestionHeaderProps): React.JSX.Element {
  return (
    <>
      <Text className={cn("text-question-color m-0 block text-base leading-6 font-semibold", className)}>
        {headline}
      </Text>
      {subheader && (
        <Text className="text-question-color m-0 block p-0 text-sm leading-6 font-normal">{subheader}</Text>
      )}
    </>
  );
}
