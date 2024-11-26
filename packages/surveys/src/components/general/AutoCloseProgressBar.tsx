interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export const AutoCloseProgressBar = ({ autoCloseTimeout }: AutoCloseProgressBarProps) => {
  return (
    <div className="fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full">
      <div
        key={autoCloseTimeout}
        className="fb-bg-brand fb-z-20 fb-h-2 fb-rounded-full"
        style={{
          animation: `shrink-width-to-zero ${autoCloseTimeout}s linear forwards`,
        }}></div>
    </div>
  );
};
