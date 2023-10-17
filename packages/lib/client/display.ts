export const updateDisplay = async (displayId: string, displayInput: any, apiHost: string): Promise<void> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays/${displayId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayInput),
  });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};
