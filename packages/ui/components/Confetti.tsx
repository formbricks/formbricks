"use client";

import { useWindowSize } from "react-use";
import ReactConfetti from "react-confetti";

type ConfettiProps = {
  colors?: string[];
};

export const Confetti: React.FC<ConfettiProps> = ({
  colors = ["#00C4B8", "#eee"],
}: {
  colors?: string[];
}) => {
  const { width, height } = useWindowSize();
  return <ReactConfetti width={width} height={height} colors={colors} numberOfPieces={400} recycle={false} />;
};
