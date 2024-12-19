import { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

const SurveyLayout = ({ children }) => {
  return <div className="h-dvh">{children}</div>;
};

export default SurveyLayout;
