export function Progress({ progress }: { progress: number }) {
  return (
    <div className="progress-track h-2 w-full overflow-hidden rounded-none">
      <div
        className="transition-width progress-indicator z-20 h-full duration-500"
        style={{
          width: `${Math.floor(progress * 100).toString()}%`,
        }}
      />
    </div>
  );
}
