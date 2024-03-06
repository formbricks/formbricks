"use client";

interface AddressResponseProps {
  value: string[];
}

export const AddressResponse = ({ value }: AddressResponseProps) => {
  return (
    <div className="font-semibold">
      {value[0] && (
        <>
          {value[0]}
          <br />
        </>
      )}
      {value[1] && (
        <>
          {value[1]}
          <br />
        </>
      )}{" "}
      {value[2] && (
        <>
          {value[2]}
          <br />
        </>
      )}
      {value[3] && (
        <>
          {value[3]}
          <br />
        </>
      )}
      {value[4] && (
        <>
          {value[4]}
          <br />
        </>
      )}
      {value[5] && (
        <>
          {value[5]}
          <br />
        </>
      )}
    </div>
  );
};
