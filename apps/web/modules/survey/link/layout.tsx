import { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "contain",
};

export const LinkSurveyLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="h-dvh">{children}</div>;
};
