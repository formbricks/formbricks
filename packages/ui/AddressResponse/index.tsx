interface AddressResponseProps {
  value: string[];
}

export const AddressResponse = ({ value }: AddressResponseProps) => {
  return (
    <div className="my-1 font-semibold text-slate-700">
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
