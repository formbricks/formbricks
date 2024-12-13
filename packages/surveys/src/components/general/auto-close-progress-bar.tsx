interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: AutoCloseProgressBarProps) {
  return (
    <div className="fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full">
      <div
        key={autoCloseTimeout}
        className="fb-bg-brand fb-z-20 fb-h-2 fb-rounded-full"
        style={{
          animation: `shrink-width-to-zero ${autoCloseTimeout.toString()}s linear forwards`,
        }}
      />
    </div>
  );
}
