export const remToPx = (remValue: number): number => {
  const rootFontSize =
    typeof window === "undefined"
      ? 16
      : parseFloat(window.getComputedStyle(document.documentElement).fontSize);

  return remValue * rootFontSize;
};
