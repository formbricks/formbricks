import { useEffect } from "react";
import Router from "next/router";

const ForwardToApp = () => {
  useEffect(() => {
    Router.push("/");
  }, []);

  return <div>Redirecting to app...</div>;
};

export default ForwardToApp;
