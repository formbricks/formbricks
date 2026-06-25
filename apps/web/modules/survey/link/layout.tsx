import { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export const LinkSurveyLayout = ({ children }: { children: React.ReactNode }) => {
  // Landmarks (<header>/<main>/<footer>) are applied inside LinkSurveyWrapper so
  // the footer/logo sit outside <main> and resolve as contentinfo/banner.
  return <div className="h-dvh">{children}</div>;
};
