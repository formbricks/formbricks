const hexToRGBA = (hex: string | undefined, opacity: number): string | undefined => {
  // return undefined if hex is undefined, this is important for adding the default values to the CSS variables
  // TODO: find a better way to handle this
  if (!hex || hex === "") return undefined;

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const mixColor = (hexColor: string, mixWithHex: string, weight: number): string => {
  // Convert both colors to RGBA format
  const color1 = hexToRGBA(hexColor, 1) || "";
  const color2 = hexToRGBA(mixWithHex, 1) || "";

  // Extract RGBA values
  const [r1, g1, b1] = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
  const [r2, g2, b2] = color2.match(/\d+/g)?.map(Number) || [0, 0, 0];

  // Mix the colors
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const isLight = (color: string) => {
  let r: number | undefined, g: number | undefined, b: number | undefined;

  if (color.length === 4) {
    r = parseInt(color[1] + color[1], 16);
    g = parseInt(color[2] + color[2], 16);
    b = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) {
    r = parseInt(color[1] + color[2], 16);
    g = parseInt(color[3] + color[4], 16);
    b = parseInt(color[5] + color[6], 16);
  }
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error("Invalid color");
  }
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
};
