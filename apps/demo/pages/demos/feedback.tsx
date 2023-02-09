import { useEffect } from "react";
import AppPage from "../../components/AppPage";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function Feedback() {
  useEffect(() => {
    window.formbricks = {
      ...window.formbricks,
      config: {
        formbricksUrl: process.env.NEXT_PUBLIC_FORMBRICKS_URL,
        formId: process.env.NEXT_PUBLIC_FORMBRICKS_FEEDBACK_FORM_ID,
        contact: {
          name: "Matti Nannt",
          position: "Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
        customer: {
          name: "Formbricks",
          email: "johannes@formbricks.com",
        },
      },
    };
    import("@formbricks/feedback");
  }, []);
  return <AppPage onClickFeedback={(event) => window.formbricks.open(event)} />;
}
