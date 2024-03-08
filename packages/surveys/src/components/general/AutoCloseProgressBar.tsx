interface AutoCloseProgressBarProps {
  timeout: number;
}

export function AutoCloseProgressBar({ timeout }: AutoCloseProgressBarProps) {
  return (
    <div className="bg-accent-bg h-2 w-full overflow-hidden rounded-full">
      <div
        key={timeout}
        className="bg-brand z-20 h-2 rounded-full"
        style={{
          animation: `ShrinkWidthToZero ${timeout}s linear forwards`,
        }}></div>
    </div>
  );
}
