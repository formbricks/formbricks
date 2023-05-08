export const Headline: React.FC<{ headline: string; questionId: string }> = ({ headline, questionId }) => {
  return (
    <label
      htmlFor={questionId}
      className="block text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
      {headline}
    </label>
  );
};

export default Headline;
