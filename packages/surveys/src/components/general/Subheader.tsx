export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label
      htmlFor={questionId}
      className="block text-sm font-normal leading-6 text-[var(--fb-subheader-color)]">
      {subheader}
    </label>
  );
}
