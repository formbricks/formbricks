export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label
      htmlFor={questionId}
      className="mt-2 block text-sm font-normal leading-6 text-slate-500 dark:text-slate-400">
      {subheader}
    </label>
  );
}
