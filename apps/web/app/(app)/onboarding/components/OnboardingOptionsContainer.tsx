import { LucideProps } from "lucide-react";
import Link from "next/link";
import React, { ForwardRefExoticComponent, RefAttributes } from "react";
import { OptionCard } from "@formbricks/ui/OptionCard";

interface OnboardingOptionsContainerProps {
  options: {
    title: string;
    description: string;
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
    iconText: string;
    href: string;
  }[];
}

export const OnboardingOptionsContainer = ({ options }: OnboardingOptionsContainerProps) => {
  return (
    <div className="mt-6 grid w-5/6 grid-cols-3 gap-8 text-center lg:w-2/3">
      {options.map((option, index) => {
        const Icon = option.icon;
        return (
          <Link href={option.href}>
            <OptionCard
              size="md"
              key={index}
              title={option.title}
              description={option.description}
              loading={false}>
              <div className="flex flex-col items-center pt-6">
                <Icon className="h-16 w-16 text-slate-600" strokeWidth={1} />
                <p className="mt-4 w-fit rounded-xl bg-slate-600 px-4 text-white">{option.iconText}</p>
              </div>
            </OptionCard>
          </Link>
        );
      })}
    </div>
  );
};
