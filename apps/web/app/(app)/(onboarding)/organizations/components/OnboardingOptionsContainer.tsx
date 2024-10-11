import { LucideProps } from "lucide-react";
import Link from "next/link";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "@formbricks/lib/cn";
import { OptionCard } from "@formbricks/ui/components/OptionCard";

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
          <Icon className="h-16 w-16 text-slate-600" strokeWidth={0.5} />
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
    <div
      className={cn({
        "flex w-5/6 justify-center gap-8 text-center md:flex-row lg:w-2/3": options.length >= 3,
        "flex justify-center gap-8": options.length < 3,
      })}>
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
