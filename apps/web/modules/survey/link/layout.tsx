import { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export const LinkSurveyLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="h-dvh">{children}</div>;
};
