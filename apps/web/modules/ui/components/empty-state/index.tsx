"use client";

type EmptyStateProps = {
  text: string;
};

export const EmptyState = ({ text }: EmptyStateProps) => {
  return (
    <div className="shadow-xs rounded-xl border border-slate-100 bg-white p-4">
      <div className="w-full space-y-3">
        <div className="h-16 w-full rounded-lg bg-slate-50"></div>
        <div className="flex h-16 w-full flex-col items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
          {text}
        </div>
        <div className="h-16 w-full rounded-lg bg-slate-50"></div>
      </div>
    </div>
  );
};
