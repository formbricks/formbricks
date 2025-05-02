export const isValidEmail = (email: string): boolean => {
  // This regex comes from zod
  const regex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  return regex.test(email);
};
