export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="block text-sm font-normal leading-6 text-slate-600">
      {subheader}
    </label>
  );
}
