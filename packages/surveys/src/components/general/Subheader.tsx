interface SubheaderProps {
  subheader?: string;
  questionId: string;
  isRtl?: boolean;
}

export const Subheader = ({ subheader, questionId, isRtl = false }: SubheaderProps) => {
  return (
    <p
      htmlFor={questionId}
      className="text-subheading block break-words text-sm font-normal leading-5"
      dir={isRtl ? "rtl" : "ltr"}>
      {subheader}
    </p>
  );
};
