export const authorization = async (environmentId:string): Promise<any> => {
  const res = await fetch(`http://localhost:3000/api/v1/environments/${environmentId}/google`, {
    method: "GET",
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  console.log(res+"mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm")
  return res;
};

export const getSpreadSheets = async (environmentId:string): Promise<any> => {
  const res = await fetch(`http://localhost:3000/api/v1/environments/${environmentId}/google/spreadsheets`, {
    method: "GET",
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  return resJSON;
};

