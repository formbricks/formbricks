export default function Progress({ progress }: { progress: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-[--fb-accent-background-color]">
      <div
        className="transition-width z-20 h-2 rounded-full bg-[--fb-brand-color] duration-500"
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
