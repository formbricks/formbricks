export const LoadingSkeleton = () => (
  <div
    className="flex h-full w-full flex-col items-center justify-between p-6"
    aria-busy="true"
    // The E2E helpers wait for this to go before they read the editor (`waitForSurveyEditor`).
    data-testid="survey-editor-loading">
    {/* Top Part - Loading Navbar */}
    <div className="flex h-[10vh] w-full animate-pulse rounded-lg bg-slate-200 font-medium text-slate-900"></div>

    {/* Bottom Part - Divided into Left and Right */}
    <div className="mt-4 flex h-[85%] w-full flex-row">
      {/* Left Part - 7 Horizontal Bars */}
      <div className="flex h-full w-1/2 flex-col justify-between gap-y-2">
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
        <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-slate-200"></div>
      </div>

      {/* Right Part - Simple Box */}
      <div className="ml-4 flex h-full w-1/2 flex-col">
        <div className="ph-no-capture h-full animate-pulse rounded-lg bg-slate-200"></div>
      </div>
    </div>
  </div>
);
