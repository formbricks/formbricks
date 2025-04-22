"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";

interface PictureSelectionResponseProps {
  choices: { id: string; imageUrl: string }[];
  selected: string | number | string[];
  isExpanded?: boolean;
}

export const PictureSelectionResponse = ({
  choices,
  selected,
  isExpanded = true,
}: PictureSelectionResponseProps) => {
  if (typeof selected !== "object") return null;

  const choiceImageMapping = choices.reduce(
    (acc, choice) => {
      acc[choice.id] = choice.imageUrl;
      return acc;
    },
    {} as Record<string, string>
  );

  return (
    <div className={cn("my-1 flex gap-x-5 gap-y-4", isExpanded ? "flex-wrap" : "")}>
      {selected.map((id) => (
        <div className="relative h-10 w-16" key={id}>
          {choiceImageMapping[id] && (
            <Image
              src={choiceImageMapping[id]}
              alt={choiceImageMapping[id].split("/").pop() || "Image"}
              fill
              style={{ objectFit: "cover" }}
              className="rounded-lg"
            />
          )}
        </div>
      ))}
    </div>
  );
};
