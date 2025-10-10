export const calculateExpirationDate = (expirationDays: number) => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);
  return expirationDate.toISOString();
};
