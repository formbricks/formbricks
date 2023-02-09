export default function Progressbar({ progress }: { progress: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-1.5 rounded-full bg-slate-700 dark:bg-slate-300"
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
