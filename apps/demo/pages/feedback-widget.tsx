import Script from "next/script";
import AppPage from "../components/AppPage";

declare global {
  interface Window {
    formbricks: any;
  }
}

const formbricksConfig = {
  hqUrl: "http://localhost:3000",
  formId: "cld8pxn4j0000yznuo6qggxfu",
  contact: {
    name: "Johannes",
    position: "Founder",
    imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
  },
  customer: {
    name: "Matti",
    email: "matti@formbricks.com",
  },
};

export default function FeedbackWidget() {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.2.1/dist/index.umd.js" defer />
      <>
        <AppPage onClickFeedback={(event) => window.formbricks.open(event, formbricksConfig)} />
      </>
    </>
  );
}
