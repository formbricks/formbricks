export const Subheader = ({ subheader, questionId }: { subheader?: string; questionId: string }) => {
  return (
    <p htmlFor={questionId} className="text-subheading block break-words text-sm font-normal leading-5">
      {subheader}
    </p>
  );
};
