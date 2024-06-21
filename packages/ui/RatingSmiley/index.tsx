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

const colors = [
  "fill-[#FF0000]",
  "fill-[#FF3300]",
  "fill-[#FF6600]",
  "fill-[#FF9900]",
  "fill-[#FFCC00]",
  "fill-[#FFFF00]",
  "fill-[#CCFF00]",
  "fill-[#99FF00]",
  "fill-[#66FF00]",
  "fill-[#33FF00]",
];
export const RatingSmiley = ({ active, idx, range, addColors }: RatingSmileyProps): JSX.Element => {
  const activeColor = "fill-rating-fill";
  const getInactiveColor = (idx: number) => {
    return addColors ? colors[idx] : "fill-none";
  };

  let icons = [
    <TiredFace className={active ? activeColor : getInactiveColor(0)} />,
    <WearyFace className={active ? activeColor : getInactiveColor(1)} />,
    <PerseveringFace className={active ? activeColor : getInactiveColor(2)} />,
    <FrowningFace className={active ? activeColor : getInactiveColor(3)} />,
    <ConfusedFace className={active ? activeColor : getInactiveColor(4)} />,
    <NeutralFace className={active ? activeColor : getInactiveColor(5)} />,
    <SlightlySmilingFace className={active ? activeColor : getInactiveColor(6)} />,
    <SmilingFaceWithSmilingEyes className={active ? activeColor : getInactiveColor(7)} />,
    <GrinningFaceWithSmilingEyes className={active ? activeColor : getInactiveColor(8)} />,
    <GrinningSquintingFace className={active ? activeColor : getInactiveColor(9)} />,
  ];

  if (range == 7) icons = [icons[1], icons[3], icons[4], icons[5], icons[6], icons[8], icons[9]];
  else if (range == 5) icons = [icons[3], icons[4], icons[5], icons[6], icons[7]];
  else if (range == 4) icons = [icons[4], icons[5], icons[6], icons[7]];
  else if (range == 3) icons = [icons[4], icons[5], icons[7]];
  return icons[idx];
};
