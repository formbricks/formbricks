export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

export function isLight(color) {
  let r, g, b;
  if (color.length === 4) {
    r = parseInt(color[1] + color[1], 16);
    g = parseInt(color[2] + color[2], 16);
    b = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) {
    r = parseInt(color[1] + color[2], 16);
    g = parseInt(color[3] + color[4], 16);
    b = parseInt(color[5] + color[6], 16);
  }
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}

export const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  const otherIndex = newArray.findIndex(item => item.id === "other");
  if (otherIndex !== -1) {
    const otherItem = newArray.splice(otherIndex, 1)[0];
    newArray.sort(() => Math.random() - 0.5);
    newArray.push(otherItem);
  } else {
    newArray.sort(() => Math.random() - 0.5);
  }
  return newArray;
}