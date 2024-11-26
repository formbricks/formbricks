export const getNPSOptionColor = (idx: number): string => {
  if (idx > 8) return "bg-emerald-100";
  if (idx > 6) return "bg-orange-100";
  return "bg-rose-100";
};

export const getRatingNumberOptionColor = (range: number, idx: number): string => {
  if (range > 5) {
    if (range - idx < 2) return "bg-emerald-100";
    if (range - idx < 4) return "bg-orange-100";
    return "bg-rose-100";
  } else if (range < 5) {
    if (range - idx < 1) return "bg-emerald-100";
    if (range - idx < 2) return "bg-orange-100";
    return "bg-rose-100";
  }
  if (range - idx < 2) return "bg-emerald-100";
  if (range - idx < 3) return "bg-orange-100";
  return "bg-rose-100";
};
