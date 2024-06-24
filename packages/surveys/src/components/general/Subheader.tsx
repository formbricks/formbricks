interface SubheaderProps {
  subheader?: string;
  questionId: string;
}

export const Subheader = ({ subheader, questionId }: SubheaderProps) => {
  return (
    <p
      htmlFor={questionId}
      className="text-subheading block break-words text-sm font-normal leading-5"
      dir="auto">
      {subheader}
    </p>
  );
};
