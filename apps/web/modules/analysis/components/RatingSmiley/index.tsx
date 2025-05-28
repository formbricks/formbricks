import type { JSX } from "react";

interface RatingSmileyProps {
  active: boolean;
  idx: number;
  range: number;
  addColors?: boolean;
}

const getSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "fill-emerald-100";
    if (range - idx < 5) return "fill-orange-100";
    return "fill-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "fill-emerald-100";
    if (range - idx < 3) return "fill-orange-100";
    return "fill-rose-100";
  } else {
    if (range - idx < 3) return "fill-emerald-100";
    if (range - idx < 4) return "fill-orange-100";
    return "fill-rose-100";
  }
};

// Helper function to get smiley image URL based on index and range
const getSmiley = (
  iconIdx: number,
  idx: number,
  range: number,
  active: boolean,
  addColors: boolean
): JSX.Element => {
  const activeColor = "fill-rating-fill";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "fill-none";

  const totalOptions = [
    "tired",
    "weary",
    "persevering",
    "frowning",
    "confused",
    "neutral",
    "slightly-smiling",
    "smiling-face-with-smiling-eyes",
    "grinning-face-with-smiling-eyes",
    "grinning-squinting-face",
  ];

  const icon = (
    <img
      className={active ? activeColor : inactiveColor}
      src={`/smiley-icons/${totalOptions[iconIdx]}-face.png`}
      alt={totalOptions[iconIdx]}
      width={36}
      height={36}
    />
  );

  return <div className="flex">{icon}</div>;
};

export const RatingSmiley = ({ active, idx, range, addColors = false }: RatingSmileyProps): JSX.Element => {
  let iconsIdx: number[] = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 6) iconsIdx = [0, 2, 4, 5, 7, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmiley(iconsIdx[idx], idx, range, active, addColors);
};
