import { Sidebar } from "./Sidebar";

export const LayoutApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-full">
      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col lg:pl-64">{children}</div>
    </div>
  );
};
