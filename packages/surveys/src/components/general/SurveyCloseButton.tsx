interface SurveyCloseButtonProps {
  onClose: () => void;
}

export const SurveyCloseButton = ({ onClose }: SurveyCloseButtonProps) => {
  return (
    <div class="absolute right-2 top-2 z-[1001] block pr-1 pt-1">
      <button
        type="button"
        onClick={onClose}
        class="text-close-button hover:text-close-button-focus focus:ring-close-button-focus relative h-4 w-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2">
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4L20 20M4 20L20 4" />
        </svg>
      </button>
    </div>
  );
};
