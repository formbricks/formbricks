import { RatingSmiley } from "@/modules/analysis/components/RatingSmiley";
import { StarIcon } from "lucide-react";

interface RatingResponseProps {
  scale?: "number" | "star" | "smiley";
  range?: number;
  answer: string | number | string[];
  addColors?: boolean;
}

export const RatingResponse: React.FC<RatingResponseProps> = ({
  scale,
  range,
  answer,
  addColors = false,
}) => {
  if (typeof answer !== "number") return null;
  if (typeof scale === "undefined" || typeof range === "undefined") return answer;

  if (scale === "star") {
    // show number of stars according to answer value
    const stars: any = [];
    for (let i = 0; i < range; i++) {
      if (i < parseInt(answer.toString())) {
        stars.push(<StarIcon key={i} fill="rgb(250 204 21)" className="h-7 text-yellow-400" />);
      } else {
        stars.push(<StarIcon key={i} className="h-7 text-slate-300" />);
      }
    }
    return <div className="flex">{stars}</div>;
  }

  if (scale === "smiley")
    return <RatingSmiley active={false} idx={answer - 1} range={range} addColors={addColors} />;

  return answer;
};
