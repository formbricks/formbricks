export function Progress({ progress }: { progress: number }) {
  return (
    <div className="progress-track relative w-full overflow-hidden">
      <div
        className="progress-indicator h-full w-full flex-1 transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${100 - Math.floor(progress * 100)}%)` }}
      />
    </div>
  );
}
