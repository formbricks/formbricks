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

const shuffle = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const shuffleArray = (array: any[], shuffleOption: string) => {
  const otherIndex = array.findIndex((element) => element.id === "other");
  const otherElement = otherIndex !== -1 ? array.splice(otherIndex, 1)[0] : null;

  if (shuffleOption === "all") {
    shuffle(array);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = array.pop();
    shuffle(array);
    array.push(lastElement);
  }

  if (otherElement) {
    array.push(otherElement);
  }

  return array;
};
