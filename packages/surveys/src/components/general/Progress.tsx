export function Progress({ progress }: { progress: number }) {
  return (
    <div className="fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full">
      <div
        className="fb-transition-width fb-bg-brand fb-z-20 fb-h-2 fb-rounded-full fb-duration-500"
        style={{ width: `${Math.floor(progress * 100).toString()}%` }}
      />
    </div>
  );
}
