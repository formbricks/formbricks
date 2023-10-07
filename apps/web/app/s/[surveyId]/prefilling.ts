import { QuestionType } from "@formbricks/types/questions";
import { TResponseData } from "@formbricks/types/v1/responses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/v1/surveys";

export function getPrefillResponseData(
  currentQuestion: TSurveyQuestion,
  survey: TSurvey,
  firstQuestionPrefill: string
): TResponseData | undefined {
  try {
    if (firstQuestionPrefill) {
      if (!currentQuestion) return;
      const firstQuestionId = survey?.questions[0].id;
      if (currentQuestion.id !== firstQuestionId) return;
      const question = survey?.questions.find((q: any) => q.id === firstQuestionId);
      if (!question) throw new Error("Question not found");

      const answer = transformAnswer(question, firstQuestionPrefill || "");
      const answerObj = { [firstQuestionId]: answer };

      if (
        question.type === QuestionType.CTA &&
        question.buttonExternal &&
        question.buttonUrl &&
        answer === "clicked"
      ) {
        window?.open(question.buttonUrl, "blank");
      }

      return answerObj;
    }
  } catch (error) {
    console.log(error);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}

export const checkValidity = (question: TSurveyQuestion, answer: any): boolean => {
  if (question.required && (!answer || answer === "")) return false;
  try {
    switch (question.type) {
      case QuestionType.OpenText: {
        return true;
      }
      case QuestionType.MultipleChoiceSingle: {
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!question.choices.find((choice) => choice.label === answer)) return false;
          return true;
        }
        return true;
      }
      case QuestionType.MultipleChoiceMulti: {
        answer = answer.split(",");
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!answer.every((ans: string) => question.choices.find((choice) => choice.label === ans)))
            return false;
          return true;
        }
        return true;
      }
      case QuestionType.NPS: {
        answer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(answer));

        if (isNaN(answerNumber)) return false;
        if (answerNumber < 0 || answerNumber > 10) return false;
        return true;
      }
      case QuestionType.CTA: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "clicked" && answer !== "dismissed") return false;
        return true;
      }
      case QuestionType.Consent: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "accepted" && answer !== "dismissed") return false;
        return true;
      }
      case QuestionType.Rating: {
        answer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(answer));
        if (answerNumber < 1 || answerNumber > question.range) return false;
        return true;
      }
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
};

export const transformAnswer = (question: TSurveyQuestion, answer: string): string | number | string[] => {
  switch (question.type) {
    case QuestionType.OpenText:
    case QuestionType.MultipleChoiceSingle:
    case QuestionType.Consent:
    case QuestionType.CTA: {
      return answer;
    }

    case QuestionType.Rating:
    case QuestionType.NPS: {
      answer = answer.replace(/&/g, ";");
      return Number(JSON.parse(answer));
    }

    case QuestionType.MultipleChoiceMulti: {
      let ansArr = answer.split(",");
      const hasOthers = question.choices[question.choices.length - 1].id === "other";
      if (!hasOthers) return ansArr;

      // answer can be "a,b,c,d" and options can be a,c,others so we are filtering out the options that are not in the options list and sending these non-existing values as a single string(representing others) like "a", "c", "b,d"
      const options = question.choices.map((o) => o.label);
      const others = ansArr.filter((a: string) => !options.includes(a));
      if (others.length > 0) ansArr = ansArr.filter((a: string) => options.includes(a));
      if (others.length > 0) ansArr.push(others.join(","));
      return ansArr;
    }

    default:
      return "dismissed";
  }
};
