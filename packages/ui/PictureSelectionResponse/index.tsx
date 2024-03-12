"use client";

import Image from "next/image";

interface PictureSelectionResponseProps {
  choices: { id: string; imageUrl: string }[];
  selected: string | number | string[];
}

export const PictureSelectionResponse = ({ choices, selected }: PictureSelectionResponseProps) => {
  if (typeof selected !== "object") return null;

  const choiceImageMapping = choices.reduce(
    (acc, choice) => {
      acc[choice.id] = choice.imageUrl;
      return acc;
    },
    {} as Record<string, string>
  );

  return (
    <div className="my-1 flex flex-wrap gap-x-5 gap-y-4">
      {selected.map((id) => (
        <div className="relative h-32 w-56" key={id}>
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
