interface SurveyCloseButtonProps {
  onClose?: () => void;
}

export function SurveyCloseButton({ onClose }: SurveyCloseButtonProps) {
  return (
    <div className="z-[1001] flex w-fit items-center even:border-l even:pl-1">
      <button
        type="button"
        onClick={onClose}
        className="text-heading relative h-5 w-5 rounded-md hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2">
        <svg
          className="h-5 w-5 p-0.5"
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
