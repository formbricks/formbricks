import { LucideProps } from "lucide-react";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import { OptionCard } from "@/modules/ui/components/option-card";

interface OnboardingOptionsContainerProps {
  options: {
    title: string;
    description: string;
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
    iconText?: string;
    href?: string;
    onClick?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    disabledDescription?: string;
    children?: React.ReactNode;
  }[];
}

export const OnboardingOptionsContainer = ({ options }: Readonly<OnboardingOptionsContainerProps>) => {
  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-8 text-center sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => {
        const Icon = option.icon;

        return (
          <div key={option.title} className="flex h-full flex-col items-center gap-2">
            <OptionCard
              size="md"
              title={option.title}
              description={option.description}
              href={option.disabled ? undefined : option.href}
              onSelect={option.onClick}
              loading={option.isLoading ?? false}
              disabled={option.disabled}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                {option.children}
                <Icon aria-hidden className="size-16 text-slate-600" strokeWidth={1} absoluteStrokeWidth />
              </div>
              {option.iconText && (
                <p className="w-fit rounded-xl bg-slate-200 px-4 text-sm text-slate-700">{option.iconText}</p>
              )}
            </OptionCard>
            {option.disabled && option.disabledDescription && (
              <p className="max-w-80 text-xs text-slate-400">{option.disabledDescription}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
