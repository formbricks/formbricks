import { useEffect } from "react";

declare global {
  interface Window {
    formbricksPmf: any;
  }
}

export default function PmfDummy() {
  useEffect(() => {
    window.formbricksPmf = {
      ...window.formbricksPmf,
      config: {
        formbricksUrl: "https://app.formbricks.com",
        formId: "cle2plrty0002nu0hqt83bi8q",
        containerId: "formbricks",
        customer: {
          id: "blog@formbricks.com",
          name: "Blog Submissions",
          email: "blog@formbricks.com",
        },
      },
    };
    require("@formbricks/pmf");
    window.formbricksPmf.init();
  }, []);

  return <div className="my-4 overflow-hidden rounded-lg bg-slate-100 shadow-lg" id="formbricks"></div>;
}
