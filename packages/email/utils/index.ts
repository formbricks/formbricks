export const getNPSOptionColor = (idx: number) => {
  return idx > 8 ? "bg-emerald-100" : idx > 6 ? "bg-orange-100" : "bg-rose-100";
};

export const getRatingNumberOptionColor = (range: number, idx: number) => {
  if (range > 5) {
    return range - idx < 2 ? "bg-emerald-100" : range - idx < 3 ? "bg-orange-100" : "bg-rose-100";
  } else {
    return range - idx < 1 ? "bg-emerald-100" : range - idx < 2 ? "bg-orange-100" : "bg-rose-100";
  }
};
