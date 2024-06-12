interface SurveyCloseButtonProps {
  onClose: () => void;
}

export const SurveyCloseButton = ({ onClose }: SurveyCloseButtonProps) => {
  return (
    <div class=" z-[1001] flex items-center">
      <button
        type="button"
        onClick={onClose}
        class="text-heading relative h-4 w-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2">
        <svg
          class="h-4 w-4"
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
};
