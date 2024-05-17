import { Logo } from "@formbricks/ui/Logo";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

interface OnboardingHeaderProps {
  progress: number;
}
export const OnboardingHeader = ({ progress }: OnboardingHeaderProps) => {
  return (
    <div className="sticky z-50 mt-6 grid w-11/12 max-w-6xl grid-cols-6 items-center rounded-xl border border-slate-200 bg-white px-6 py-3">
      <div className="col-span-2">
        <Logo className="ml-4 w-1/2" />
      </div>
      <div className="col-span-1" />
      <div className="col-span-3 flex items-center justify-center gap-8">
        <div className="relative grow overflow-hidden rounded-full bg-slate-200">
          <ProgressBar progress={progress / 100} barColor="bg-brand-dark" height={2} />
        </div>
        <span className="text-sm text-slate-800">{progress}% complete</span>
      </div>
    </div>
  );
};
