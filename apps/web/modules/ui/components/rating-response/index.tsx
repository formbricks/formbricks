import { StarIcon } from "lucide-react";
import { RatingSmiley } from "@/modules/analysis/components/RatingSmiley";

interface RatingResponseProps {
  scale?: "number" | "star" | "smiley";
  range?: number;
  answer: string | number | string[];
  addColors?: boolean;
  variant?: "default" | "individual" | "aggregated" | "scale";
}

const NumberBox = ({ answer, size }: { answer: number; size: "small" | "medium" | "large" }) => {
  const sizeClasses = {
    small: "h-6 w-6 text-xs",
    medium: "h-7 w-7 text-xs",
    large: "h-12 w-12 text-base",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-md bg-slate-100 font-semibold text-slate-700 ${sizeClasses[size]}`}>
      {answer}
    </div>
  );
};

const renderStarScale = (answer: number, variant: string, range: number) => {
  if (variant === "scale") {
    return answer === 1 ? (
      <StarIcon className="h-6 w-6 text-slate-300" />
    ) : (
      <StarIcon fill="rgb(250 204 21)" className="h-6 w-6 text-yellow-400" />
    );
  }

  if (variant === "aggregated") {
    return <NumberBox answer={answer} size="medium" />;
  }

  if (variant === "individual" && range > 5) {
    return (
      <div className="flex items-center space-x-2">
        <StarIcon className="h-5 w-5 text-slate-300" />
        <span className="text-base font-semibold text-slate-700">{answer}</span>
        <StarIcon fill="rgb(250 204 21)" className="h-5 w-5 text-yellow-400" />
      </div>
    );
  }

  const stars = Array.from({ length: range }, (_, i) => (
    <StarIcon
      key={i}
      fill={i < answer ? "rgb(250 204 21)" : "none"}
      className={`h-7 ${i < answer ? "text-yellow-400" : "text-slate-300"}`}
    />
  ));

  return <div className="flex">{stars}</div>;
};

const renderSmileyScale = (answer: number, variant: string, range: number, addColors: boolean) => {
  if (variant === "scale") {
    return (
      <div className="flex h-6 w-6 items-center justify-center">
        <RatingSmiley active={false} idx={answer - 1} range={range} addColors={addColors} />
      </div>
    );
  }

  if (variant === "aggregated") {
    return <NumberBox answer={answer} size="medium" />;
  }

  return <RatingSmiley active={false} idx={answer - 1} range={range} addColors={addColors} />;
};

const renderNumberScale = (answer: number, variant: string) => {
  if (variant === "scale") return <NumberBox answer={answer} size="small" />;
  if (variant === "aggregated") return <NumberBox answer={answer} size="medium" />;
  return <NumberBox answer={answer} size="large" />;
};

export const RatingResponse: React.FC<RatingResponseProps> = ({
  scale,
  range,
  answer,
  addColors = false,
  variant = "default",
}) => {
  if (typeof answer !== "number") return null;
  if (typeof scale === "undefined" || typeof range === "undefined") return answer;
  if (scale === "star") return renderStarScale(answer, variant, range);
  if (scale === "smiley") return renderSmileyScale(answer, variant, range, addColors);
  return renderNumberScale(answer, variant);
};
