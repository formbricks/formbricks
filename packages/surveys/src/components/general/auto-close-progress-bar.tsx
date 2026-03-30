interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: AutoCloseProgressBarProps) {
  return (
    <div className="bg-accent-bg h-2 w-full overflow-hidden">
      <div
        key={autoCloseTimeout}
        className="bg-brand z-20 h-2"
        style={{
          animation: `shrink-width-to-zero ${autoCloseTimeout.toString()}s linear forwards`,
          width: "100%",
        }}
      />
    </div>
  );
}
