export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label htmlFor={questionId} className="text-subheading block text-sm font-normal leading-5">
      {subheader}
    </label>
  );
}
