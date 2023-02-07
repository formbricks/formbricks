import { useEffect } from "react";
import Router from "next/router";

const ForwardToApp = () => {
  useEffect(() => {
    setTimeout(() => Router.push("/"), 1000);
  }, []);

  return (
    <div className="text-center text-sm text-slate-700">
      Thanks you 🕺
      <br />
      <br />
      Redirecting to app...
    </div>
  );
};

export default ForwardToApp;
