export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="block break-words text-sm font-normal leading-6 text-slate-500">
      {subheader}
    </label>
  );
}
