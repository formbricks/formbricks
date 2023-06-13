export const convertToCSV = async (data: { json: any; fields?: string[] }) => {
  const response = await fetch("/api/csv-conversion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
};
