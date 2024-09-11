interface ContactInfoResponseProps {
  value: string[];
}

export const ContactInfoResponse = ({ value }: ContactInfoResponseProps) => {
  return (
    <div className="my-1 font-normal text-slate-700" dir="auto">
      {value.map(
        (item, index) =>
          item && (
            <div key={index}>
              {item}
              <br />
            </div>
          )
      )}
    </div>
  );
};
