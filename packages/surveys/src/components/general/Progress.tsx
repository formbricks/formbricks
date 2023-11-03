export default function Progress({ progress }: { progress: number }) {
  return (
    <div className="bg-accent-bg h-2 w-full rounded-full">
      <div
        className="transition-width bg-brand z-20 h-2 rounded-full duration-500"
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
