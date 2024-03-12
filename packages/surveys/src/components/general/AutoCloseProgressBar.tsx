interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: AutoCloseProgressBarProps) {
  return (
    <div className="bg-accent-bg h-2 w-full overflow-hidden rounded-full">
      <div
        key={autoCloseTimeout}
        className="bg-brand z-20 h-2 rounded-full"
        style={{
          animation: `shrink-width-to-zero ${autoCloseTimeout}s linear forwards`,
        }}></div>
    </div>
  );
}
