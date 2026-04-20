import type { JSX } from "react";

interface RatingSmileyProps {
  active: boolean;
  idx: number;
  range: number;
  addColors?: boolean;
  baseUrl?: string;
}

const getSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "bg-emerald-100";
    if (range - idx < 5) return "bg-orange-100";
    return "bg-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "bg-emerald-100";
    if (range - idx < 3) return "bg-orange-100";
    return "bg-rose-100";
  } else {
    if (range - idx < 3) return "bg-emerald-100";
    if (range - idx < 4) return "bg-orange-100";
    return "bg-rose-100";
  }
};

// Helper function to get smiley image URL based on index and range
const getSmiley = (
  iconIdx: number,
  idx: number,
  range: number,
  active: boolean,
  addColors: boolean,
  baseUrl?: string
): JSX.Element => {
  const activeColor = "bg-rating-fill";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "bg-fill-none";

  const faceIcons = [
    "tired",
    "weary",
    "persevering",
    "frowning",
    "confused",
    "neutral",
    "slightly-smiling",
    "smiling-face-with-smiling-eyes",
    "grinning-face-with-smiling-eyes",
    "grinning-squinting",
  ];

  const icon = (
    <img
      data-testid={faceIcons[iconIdx]}
      src={
        baseUrl
          ? `${baseUrl}/smiley-icons/${faceIcons[iconIdx]}-face.png`
          : `/smiley-icons/${faceIcons[iconIdx]}-face.png`
      }
      alt={faceIcons[iconIdx]}
      width={24}
      height={24}
      className={`${active ? activeColor : inactiveColor} rounded-full`}
    />
  );

  return (
    <table style={{ width: "48px", height: "48px" }}>
      {" "}
      {/* NOSONAR S5256 - Need table layout for email compatibility (gmail) */}
      <tr>
        <td align="center" valign="middle">
          {icon}
        </td>
      </tr>
    </table>
  );
};

export const RatingSmiley = ({
  active,
  idx,
  range,
  addColors = false,
  baseUrl,
}: RatingSmileyProps): JSX.Element => {
  let iconsIdx: number[] = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 6) iconsIdx = [0, 2, 4, 5, 7, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmiley(iconsIdx[idx], idx, range, active, addColors, baseUrl);
};
