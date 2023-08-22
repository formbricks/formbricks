export default function Loading() {
  return (
    <div className="flex flex-col h-full w-full items-center justify-between p-6">
      {/* Top Part - Loading Navbar */}
      <div className="flex h-[10vh] w-full animate-pulse rounded-lg bg-gray-200 font-medium text-slate-900">
        {/* Navbar content */}
      </div>

      {/* Bottom Part - Divided into Left and Right */}
      <div className="flex flex-row w-full mt-4 h-[85%]">
        {/* Left Part - 6 Horizontal Bars */}
        <div className="flex flex-col h-full w-1/2 space-y-2 justify-between">
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
          <div className="ph-no-capture h-[10vh] animate-pulse rounded-lg bg-gray-200"></div>
         
        </div>

        {/* Right Part - Simple Box */}
        <div className="flex flex-col w-1/2 h-full ml-4">
          <div className="ph-no-capture h-full animate-pulse rounded-lg bg-gray-200"></div>
        </div>
      </div>
    </div>
  );
}
