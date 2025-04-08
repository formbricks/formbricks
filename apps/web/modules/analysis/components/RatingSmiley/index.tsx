import type { JSX } from "react";
import {
  ConfusedFace,
  FrowningFace,
  GrinningFaceWithSmilingEyes,
  GrinningSquintingFace,
  NeutralFace,
  PerseveringFace,
  SlightlySmilingFace,
  SmilingFaceWithSmilingEyes,
  TiredFace,
  WearyFace,
} from "../SingleResponseCard/components/Smileys";

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

const getSmiley = (iconIdx: number, idx: number, range: number, active: boolean, addColors: boolean) => {
  const activeColor = "fill-rating-fill";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "fill-none";

  const icons = [
    <TiredFace className={active ? activeColor : inactiveColor} data-testid="TiredFace" />,
    <WearyFace className={active ? activeColor : inactiveColor} data-testid="WearyFace" />,
    <PerseveringFace className={active ? activeColor : inactiveColor} data-testid="PerseveringFace" />,
    <FrowningFace className={active ? activeColor : inactiveColor} data-testid="Frowningface" />,
    <ConfusedFace className={active ? activeColor : inactiveColor} data-testid="ConfusedFace" />,
    <NeutralFace className={active ? activeColor : inactiveColor} data-testid="NeutralFace" />,
    <SlightlySmilingFace
      className={active ? activeColor : inactiveColor}
      data-testid="SlightlySmilingFace"
    />,
    <SmilingFaceWithSmilingEyes
      className={active ? activeColor : inactiveColor}
      data-testid="SmilingFaceWithSmilingEyes"
    />,
    <GrinningFaceWithSmilingEyes
      className={active ? activeColor : inactiveColor}
      data-testid="GrinningFaceWithSmilingEyes"
    />,
    <GrinningSquintingFace
      className={active ? activeColor : inactiveColor}
      data-testid="GrinningSquintingFace"
    />,
  ];

  return icons[iconIdx];
};

export const RatingSmiley = ({ active, idx, range, addColors = false }: RatingSmileyProps): JSX.Element => {
  let iconsIdx: number[] = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmiley(iconsIdx[idx], idx, range, active, addColors);
};
