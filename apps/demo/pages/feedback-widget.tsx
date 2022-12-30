import Script from "next/script";
import AppPage from "../components/AppPage";

export default function FeedbackWidget() {
  return (
    <>
      <Script src="https://unpkg.com/@formbricks/feedback@0.1.0/dist/index.umd.js" defer />
      <Script id="feedbackfin-setup">{`
      window.formbricks = {
      config: {
        hqUrl: "http://localhost:3000",
        formId: "clbxex6f70006yz3f2n4knxfa",
        customer: {
          id: "matti@formbricks.com",
          name: "Matti",
          email: "matti@formbricks.com",
        },
      },
      ...window.formbricks,
    };`}</Script>
      <button onClick={(event) => window.formbricks.open(event)}>Feedback</button>
      <>
        <AppPage onClickFeedback={(event) => window.formbricks.open(event)} />
      </>
    </>
  );
}
