import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";

export const LoadingCard = ({
  title,
  description,
  skeletonLines,
}: {
  title: string;
  description: string;
  skeletonLines: Array<{ classes: string }>;
}) => {
  return (
    <SettingsCard title={title} description={description}>
      <div className="w-full space-y-4">
        {skeletonLines.map((line, index) => (
          <div key={index}>
            <div className={cn("animate-pulse rounded-full bg-slate-200", line.classes)}></div>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
};
