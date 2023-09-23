export const fetchFile = async (
  data: { json: any; fields?: string[]; fileName?: string },
  filetype: string
) => {
  const endpoint = filetype === "csv" ? "csv-conversion" : "excel-conversion";

  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to convert to file");

  return response.json();
};
