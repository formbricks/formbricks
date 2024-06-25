export const getNPSOptionColor = (idx: number): string => {
  if (idx > 8) return "bg-emerald-100";
  if (idx > 6) return "bg-orange-100";
  return "bg-rose-100";
};

export const getRatingNumberOptionColor = (range: number, idx: number) => {
  if (range > 5) {
    return range - idx < 2 ? "bg-emerald-100" : range - idx < 4 ? "bg-orange-100" : "bg-rose-100";
  } else if (range < 5) {
    return range - idx < 1 ? "bg-emerald-100" : range - idx < 2 ? "bg-orange-100" : "bg-rose-100";
  } else {
    return range - idx < 2 ? "bg-emerald-100" : range - idx < 3 ? "bg-orange-100" : "bg-rose-100";
  }
};
