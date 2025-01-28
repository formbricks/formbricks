"use client";
import { type JSX } from "react";
interface AdQuestionFormProps {}

export const AdQuestionForm = ({}: AdQuestionFormProps): JSX.Element => {
  return (
    <form>
      <p style={{ color: "gray", fontStyle: "italic" }}>
        No configuration needed here, an ad will magically appear! 🎩✨
      </p>
    </form>
  );
};
