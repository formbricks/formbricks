import { useResponses } from "@/lib/responses/responses";
import { useCreateTag } from "@/lib/tags/mutateTags";
import { Button, Input } from "@formbricks/ui";
import React from "react";
import { useState } from "react";

interface IResponseTagsWrapperProps {
  data: {
    tagId: string;
    tagName: string;
  }[];

  environmentId: string;
  surveyId: string;
  productId: string;
  responseId: string;
}

const ResponseTagsWrapper: React.FC<IResponseTagsWrapperProps> = ({
  data,
  environmentId,
  productId,
  responseId,
  surveyId,
}) => {
  const [newTagValue, setNewTagValue] = useState("");
  const { createTag, isCreatingTag } = useCreateTag(environmentId, surveyId, responseId);

  const { mutateResponses } = useResponses(environmentId, surveyId);

  return (
    <div className="flex items-center gap-3 p-6">
      <div className="flex items-center gap-2">
        {data.map((tag) => (
          <div
            key={tag.tagId}
            className="relative flex items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
            <span className="text-sm">#{tag.tagName}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newTagValue}
          onChange={(e) => {
            setNewTagValue(e.target.value);
          }}
        />

        <Button
          variant="darkCTA"
          onClick={() =>
            createTag(
              { name: newTagValue, productId },
              {
                onSuccess: () => {
                  mutateResponses();
                  setNewTagValue("");
                },
              }
            )
          }
          loading={isCreatingTag}>
          <div className="flex items-center gap-1">
            <span>+</span>
            <span>Add</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default ResponseTagsWrapper;
