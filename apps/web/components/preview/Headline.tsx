export default function Headline({ headline, questionId }: { headline: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="block text-base font-semibold leading-6 text-slate-900">
      {headline}
    </label>
  );
}
