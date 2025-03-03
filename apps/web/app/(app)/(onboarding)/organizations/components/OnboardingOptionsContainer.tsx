import { OptionCard } from "@/modules/ui/components/option-card";
import { LucideProps } from "lucide-react";
import Link from "next/link";
import { ForwardRefExoticComponent, RefAttributes } from "react";

interface OnboardingOptionsContainerProps {
  options: {
    title: string;
    description: string;
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
    iconText?: string;
    href?: string;
    onClick?: () => void;
    isLoading?: boolean;
  }[];
}

export const OnboardingOptionsContainer = ({ options }: OnboardingOptionsContainerProps) => {
  const getOptionCard = (option) => {
    const Icon = option.icon;
    return (
      <OptionCard
        size="md"
        key={option.title}
        title={option.title}
        onSelect={option.onClick}
        description={option.description}
        loading={option.isLoading || false}>
        <div className="flex flex-col items-center">
          <Icon className="h-16 w-16 text-slate-600" strokeWidth={1} />
          {option.iconText && (
            <p className="mt-4 w-fit rounded-xl bg-slate-200 px-4 text-sm text-slate-700">
              {option.iconText}
            </p>
          )}
        </div>
      </OptionCard>
    );
  };

  return (
    <div className="flex w-full max-w-5xl flex-wrap justify-center gap-8 text-center">
      {options.map((option) =>
        option.href ? (
          <Link key={option.title} href={option.href}>
            {getOptionCard(option)}
          </Link>
        ) : (
          getOptionCard(option)
        )
      )}
    </div>
  );
};
