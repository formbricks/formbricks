interface SubheaderProps {
  subheader?: string;
  questionId: string;
}

export const Subheader = ({ subheader, questionId }: SubheaderProps) => {
  return (
    <p
      htmlFor={questionId}
      className="fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-5"
      dir="auto">
      {subheader}
    </p>
  );
};
