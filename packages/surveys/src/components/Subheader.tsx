export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="fb-block fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
      {subheader}
    </label>
  );
}
