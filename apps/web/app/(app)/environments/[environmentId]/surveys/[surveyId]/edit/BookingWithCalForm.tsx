"use client";

import type { BookingWithCal } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { Input, Label } from "@formbricks/ui";

interface BookingWithCalFormProps {
  localSurvey: Survey;
  question: BookingWithCal;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
}

export default function BookingWithCalForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
}: BookingWithCalFormProps): JSX.Element {
  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="label">cal.com username</Label>
        <Input
          id="label"
          name="label"
          className="mt-2"
          value={question.label}
          onChange={(e) => {
            updateQuestion(questionIdx, { label: e.target.value });
          }}
          isInvalid={isInValid}
        />
      </div>
    </form>
  );
}
