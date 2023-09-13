"use client";

import { TSurveyBookingQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Input, Label } from "@formbricks/ui";

interface BookingQuestionFormProps {
  localSurvey: TSurveyWithAnalytics;
  question: TSurveyBookingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
}

export default function BookingQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
}: BookingQuestionFormProps): JSX.Element {
  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="calLink">Cal.com Link</Label>
        <div className="mt-2">
          <Input
            id="calLink"
            name="calLink"
            placeholder="Enter the suffix of your cal.com link, e.g., 'yourname' from cal.com/yourname."
            value={question.calLink}
            onChange={(e) => updateQuestion(questionIdx, { calLink: e.target.value })}
            isInvalid={
              isInValid &&
              question.calLink.length > 3 &&
              question.calLink.length < 20 &&
              !!question.calLink.match(/^[a-zA-Z0-9_-]+$/) &&
              question.calLink.trim() === ""
            }
            //assuming some validation logic here
          />
        </div>
      </div>
    </form>
  );
}
