export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const hexToRGBA = (hex: string | undefined, opacity: number): string | undefined => {
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

export const lightenDarkenColor = (hexColor: string, magnitude: number) => {
  hexColor = hexColor.replace(`#`, ``);

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  if (hexColor.length === 3) {
    hexColor = hexColor
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (hexColor.length === 6) {
    let decimalColor = parseInt(hexColor, 16);
    let r = (decimalColor >> 16) + magnitude;
    r = Math.max(0, Math.min(255, r)); // Clamp value between 0 and 255
    let g = ((decimalColor >> 8) & 0x00ff) + magnitude;
    g = Math.max(0, Math.min(255, g)); // Clamp value between 0 and 255
    let b = (decimalColor & 0x0000ff) + magnitude;
    b = Math.max(0, Math.min(255, b)); // Clamp value between 0 and 255

    // Convert back to hex and return
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } else {
    // Return the original color if it's neither 3 nor 6 characters
    return hexColor;
  }
};
