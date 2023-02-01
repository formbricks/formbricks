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
        formId="cldlul6ky0008qfwqp58bxv2n"
        customer={{
          id: "johannes@formbricks.com",
          email: "johannes@formbricks.com",
          name: "Johannes",
        }}
      />
    </>
  );
}
