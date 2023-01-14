import { useState } from "react";
import AppPage from "../components/AppPage";
import FeedbackModal from "../components/feedback/FeedbackModal";

export default function Example() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <AppPage onClickFeedback={() => setShowFeedback(true)} />
      <FeedbackModal
        show={showFeedback}
        setShow={setShowFeedback}
        formId="clbxex6f70006yz3f2n4knxfa"
        customer={{
          id: "johannes@formbricks.com",
          email: "johannes@formbricks.com",
          name: "Johannes",
        }}
      />
    </>
  );
}
