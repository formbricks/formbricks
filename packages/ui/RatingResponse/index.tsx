import { StarIcon } from "lucide-react";

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

interface RatingResponseProps {
  scale?: "number" | "star" | "smiley";
  range?: number;
  answer: string | number | string[];
}

export const RatingResponse: React.FC<RatingResponseProps> = ({ scale, range, answer }) => {
  if (typeof answer !== "number") return null;
  if (typeof scale === "undefined" || typeof range === "undefined") return answer;

  if (scale === "star") {
    // show number of stars according to answer value
    const stars: any = [];
    for (let i = 0; i < range; i++) {
      if (i < parseInt(answer.toString())) {
        stars.push(<StarIcon key={i} className="h-7 text-yellow-400" />);
      } else {
        stars.push(<StarIcon key={i} className="h-7 text-slate-300" />);
      }
    }
    return <div className="flex">{stars}</div>;
  }

  if (scale === "smiley") {
    if (range === 10 && answer === 1) {
      return (
        <div className="h-10 w-10">
          <TiredFace />
        </div>
      );
    }
    if ((range === 10 && answer === 2) || (range === 7 && answer === 1)) {
      return (
        <div className="h-10 w-10">
          <WearyFace />
        </div>
      );
    }
    if (range === 10 && answer === 3) {
      return (
        <div className="h-10 w-10">
          <PerseveringFace />
        </div>
      );
    }
    if ((range === 10 && answer === 4) || (range === 7 && answer === 2) || (range === 5 && answer === 1)) {
      return (
        <div className="h-10 w-10">
          <FrowningFace />
        </div>
      );
    }
    if (
      (range === 10 && answer === 5) ||
      (range === 7 && answer === 3) ||
      (range === 5 && answer === 2) ||
      (range === 4 && answer === 1) ||
      (range === 3 && answer === 1)
    ) {
      return (
        <div className="h-10 w-10">
          <ConfusedFace />
        </div>
      );
    }
    if (
      (range === 10 && answer === 6) ||
      (range === 7 && answer === 4) ||
      (range === 5 && answer === 3) ||
      (range === 4 && answer === 2) ||
      (range === 3 && answer === 2)
    ) {
      return (
        <div className="h-10 w-10">
          <NeutralFace />
        </div>
      );
    }
    if (
      (range === 10 && answer === 7) ||
      (range === 7 && answer === 5) ||
      (range === 5 && answer === 4) ||
      (range === 4 && answer === 3)
    ) {
      return (
        <div className="h-10 w-10">
          <SlightlySmilingFace />
        </div>
      );
    }
    if (
      (range === 10 && answer === 8) ||
      (range === 5 && answer === 5) ||
      (range === 4 && answer === 4) ||
      (range === 3 && answer === 3)
    ) {
      return (
        <div className="h-10 w-10">
          <SmilingFaceWithSmilingEyes />
        </div>
      );
    }
    if ((range === 10 && answer === 9) || (range === 7 && answer === 6)) {
      return (
        <div className="h-10 w-10">
          <GrinningFaceWithSmilingEyes />
        </div>
      );
    }
    if ((range === 10 && answer === 10) || (range === 7 && answer === 7)) {
      return (
        <div className="h-10 w-10">
          <GrinningSquintingFace />
        </div>
      );
    }
  }

  return answer;
};
