interface PageTitleProps {
  children: React.ReactNode;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-6 text-3xl font-bold text-slate-600">
      <h1>{children}</h1>
    </div>
  );
};
