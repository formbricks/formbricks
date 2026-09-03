interface ContentLayoutProps {
  headline: string;
  description: string;
  children?: React.ReactNode;
}

export const ContentLayout = ({ headline, description, children }: Readonly<ContentLayoutProps>) => {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-auth-backdrop px-4 py-8">
      <main className="flex w-full max-w-md flex-col gap-6 text-center text-slate-700 sm:gap-7">
        <h1 className="text-2xl font-bold text-balance sm:text-3xl">{headline}</h1>
        <p className="text-lg text-pretty sm:text-2xl">{description}</p>
        <div className="flex flex-wrap justify-center gap-3 text-xs sm:gap-5">{children}</div>
      </main>
    </div>
  );
};
