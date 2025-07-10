import { Description } from "@/modules/ui/components/description";
import { Title } from "@/modules/ui/components/title";

interface TabContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const TabContainer = ({ title, description, children }: TabContainerProps) => {
  return (
    <div className="flex h-full grow flex-col items-start space-y-4">
      <div>
        <Title>{title}</Title>
        <Description>{description}</Description>
      </div>
      {children}
    </div>
  );
};
