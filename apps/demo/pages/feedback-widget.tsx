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
      <Script src="https://unpkg.com/@formbricks/feedback@0.1.2" defer />
      <Script id="feedbackfin-setup">{`
      window.formbricks = {
      config: {
        hqUrl: "http://localhost:3000", 
        formId: "clchlxdi60006yz3rjf4sunaj",
        contact: {
          name: "Johannes",
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
      <>
        <AppPage onClickFeedback={(event) => window.formbricks.open(event)} />
      </>
    </>
  );
}
