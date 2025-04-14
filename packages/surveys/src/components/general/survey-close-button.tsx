interface SurveyCloseButtonProps {
  onClose?: () => void;
}

export function SurveyCloseButton({ onClose }: SurveyCloseButtonProps) {
  return (
    <div className="fb:z-1001 fb:flex fb:w-fit fb:items-center fb:even:border-l fb:even:pl-1">
      <button
        type="button"
        onClick={onClose}
        className="fb:text-heading fb:relative fb:h-5 fb:w-5 fb:rounded-md fb:hover:bg-black/5 fb:focus:outline-hidden fb:focus:ring-2 fb:focus:ring-offset-2">
        <svg
          className="fb:h-5 fb:w-5 fb:p-0.5"
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
