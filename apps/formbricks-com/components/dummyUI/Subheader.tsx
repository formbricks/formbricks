export const Subheader: React.FC<{ subheader?: string; questionId: string }> = ({
  subheader,
  questionId,
}) => {
  return (
    <label
      htmlFor={questionId}
      className="mt-2 block text-sm font-normal leading-6 text-slate-500 dark:text-slate-400">
      {subheader}
    </label>
  );
};

export default Subheader;
