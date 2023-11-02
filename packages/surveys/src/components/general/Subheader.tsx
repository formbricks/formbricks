export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="block text-sm font-normal leading-6 text-[--fb-subheading-color]">
      {subheader}
    </label>
  );
}
