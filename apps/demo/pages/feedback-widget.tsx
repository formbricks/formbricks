import Script from "next/script";
import AppPage from "../components/AppPage";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function FeedbackWidget() {
  return (
    <>
      <Script src="/index.umd.js" defer />
      <Script id="feedbackfin-setup">{`
      window.formbricks = {
      config: {
        hqUrl: "http://localhost:3000",
        formId: "clbxex6f70006yz3f2n4knxfa",
        contact: {
          name: "Matti Nannt",
          position: "Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
        customer: {
          id: "matti@formbricks.com",
          name: "Matti",
          email: "matti@formbricks.com",
        },
      },
      ...window.formbricks,
    };`}</Script>
      <button onClick={(event) => window.formbricks!.open(event)}>Feedback</button>
      <>
        <AppPage onClickFeedback={(event) => window.formbricks.open(event)} />
      </>
    </>
  );
}
