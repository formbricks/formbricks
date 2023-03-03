import { h } from "preact";
import { useState } from "preact/compat";
import { createSubmission, updateSubmission } from "../lib/api";
import RadioElement from "./RadioElement";
import TextInputElement from "./TextInputElement";

export default function Survey({ formId, schema, config }) {
  const [currentElement, setCurrentElement] = useState(schema.elements[0]);
  const [submissionId, setSubmissionId] = useState(null);
  const [loadingElement, setLoadingElement] = useState(false);

  const submitElement = async (value) => {
    setLoadingElement(true);
    const submissionRequest = {
      customer: config.customer,
      data: {
        [currentElement.name]: value,
      },
    };
    if (!submissionId) {
      const submission = await createSubmission(submissionRequest, formId, config);
      setSubmissionId(submission.id);
    } else {
      await updateSubmission(submissionRequest, formId, submissionId, config);
    }
    setLoadingElement(false);
    const elementIdx = schema.elements.findIndex((e) => e.name === currentElement.name);
    if (elementIdx < schema.elements.length - 1) {
      setCurrentElement(schema.elements[elementIdx + 1]);
    }
  };
  return (
    <div className={loadingElement ? "animate-pulse opacity-60" : ""}>
      {currentElement.type === "radio" ? (
        <RadioElement element={currentElement} onSubmit={submitElement} />
      ) : currentElement.type === "text" ? (
        <TextInputElement element={currentElement} onSubmit={submitElement} />
      ) : null}
    </div>
  );
}
