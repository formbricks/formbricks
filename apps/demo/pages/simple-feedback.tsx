import { useState } from "react";
import AppPage from "../components/AppPage";
import SimpleFeedbackModal from "../components/SimpleFeedbackModal";

export default function Example() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <AppPage setShowFeedback={setShowFeedback} />
      <SimpleFeedbackModal show={showFeedback} setShow={setShowFeedback} />
    </>
  );
}
