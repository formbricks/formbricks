interface ArrayResponseProps {
  value: string[];
}

export const ArrayResponse = ({ value }: ArrayResponseProps) => {
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
