export const convertToCSV = async (data: { json: any; fields?: string[]; fileName?: string }) => {
  const response = await fetch("/api/csv-conversion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to convert to CSV");

  return response.json();
};
