interface SurveyCloseButtonProps {
  onClose?: () => void;
}

export function SurveyCloseButton({ onClose }: SurveyCloseButtonProps) {
  return (
    <div className="fb-z-[1001] fb-flex fb-w-fit fb-items-center even:fb-border-l even:fb-pl-1">
      <button
        type="button"
        onClick={onClose}
        className="fb-text-heading fb-relative fb-h-5 fb-w-5 fb-rounded-md hover:fb-bg-black/5 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2">
        <svg
          className="fb-h-6 fb-w-6 fb-p-0.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1"
          stroke="currentColor"
          aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4L20 20M4 20L20 4" />
        </svg>
      </button>
    </div>
  );
}
