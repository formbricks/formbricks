"use client";

interface AddressResponseProps {
  value: string[];
}

export const AddressResponse = ({ value }: AddressResponseProps) => {
  return (
    <div className="font-semibold">
      {value[0] && (
        <>
          Address: {value[0]}
          <br />
        </>
      )}
      {value[1] && (
        <>
          Address Line 2: {value[1]}
          <br />
        </>
      )}{" "}
      {value[2] && (
        <>
          City/Town: {value[2]}
          <br />
        </>
      )}
      {value[3] && (
        <>
          State/Region: {value[3]}
          <br />
        </>
      )}
      {value[4] && (
        <>
          ZIP/Post Code: {value[4]}
          <br />
        </>
      )}
      {value[5] && (
        <>
          Country : {value[5]}
          <br />
        </>
      )}
    </div>
  );
};
