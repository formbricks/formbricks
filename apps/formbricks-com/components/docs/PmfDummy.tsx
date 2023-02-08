import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

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
        formId: "cldetkpre0000nr0hku986hio",
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
