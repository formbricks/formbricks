import { H3, Small } from "@/modules/ui/components/typography";

interface TabContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const TabContainer = ({ title, description, children }: TabContainerProps) => {
  return (
    <div className="flex h-full grow flex-col items-start space-y-4">
      <div className="pb-2">
        <H3>{title}</H3>
        <Small color="muted" margin="headerDescription">
          {description}
        </Small>
      </div>
      <div className="h-full w-full space-y-4 overflow-y-auto">{children}</div>
    </div>
  );
};
