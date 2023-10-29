"use client";

interface PictureSelectionResponseProps {
  choices: { id: string; imageUrl: string }[];
  selected: string | number | string[];
}

export const PictureSelectionResponse = ({ choices, selected }: PictureSelectionResponseProps) => {
  if (typeof selected !== "object") return null;

  const choiceImageMapping = choices.reduce((acc, choice) => {
    acc[choice.id] = choice.imageUrl;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="my-1 flex flex-wrap gap-x-5 gap-y-4">
      {selected.map((id) => (
        <img
          src={choiceImageMapping[id]}
          alt={choiceImageMapping[id].split("/").pop()}
          className="h-28 w-56 rounded-lg object-fill"
        />
      ))}
    </div>
  );
};
