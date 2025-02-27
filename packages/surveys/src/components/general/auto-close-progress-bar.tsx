interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: AutoCloseProgressBarProps) {
  return (
    <div className="fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden">
      <div
        key={autoCloseTimeout}
        className="fb-bg-brand fb-z-20 fb-h-2"
        style={{
          animation: `shrink-width-to-zero ${autoCloseTimeout.toString()}s linear forwards`,
          width: "100%",
        }}
      />
    </div>
  );
}
