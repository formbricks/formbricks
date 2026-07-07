export default function Loading() {
  return (
    <div className="p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 h-24 w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="h-[480px] animate-pulse rounded-lg bg-slate-100" />
        <div className="h-[480px] animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
