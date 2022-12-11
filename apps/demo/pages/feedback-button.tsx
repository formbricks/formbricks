import { useState } from "react";
import AppPage from "../components/AppPage";
import FeedbackModal from "../components/FeedbackModal";

export default function Example() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <AppPage />
      <FeedbackModal show={showFeedback} setShow={setShowFeedback} />
    </>
  );
}
