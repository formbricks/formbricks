interface SurveyCloseButtonProps {
  onClose: () => void;
}

export const SurveyCloseButton = ({ onClose }: SurveyCloseButtonProps) => {
  return (
    <div class=" absolute right-0 top-0 z-[1001] block pr-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        class="text-close-button hover:text-close-button-focus focus:ring-close-button-focus relative h-5 w-5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2">
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
