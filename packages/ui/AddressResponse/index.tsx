"use client";

interface AddressResponseProps {
  value: string[];
}

const getAddressKey = (index: number): string => {
  switch (index) {
    case 0:
      return "Address Line 1";
    case 1:
      return "Address Line 2";
    case 2:
      return "City / Town";
    case 3:
      return "State / Region";
    case 4:
      return "ZIP / Postcode";
    case 5:
      return "Country";
    default:
      return "";
  }
};

export const AddressResponse = ({ value }: AddressResponseProps) => {
  return (
    <div className="my-1 font-semibold text-slate-700">
      {value.map(
        (item, index) =>
          item && (
            <div key={index}>
              {getAddressKey(index)} : {item}
              <br />
            </div>
          )
      )}
    </div>
  );
};
