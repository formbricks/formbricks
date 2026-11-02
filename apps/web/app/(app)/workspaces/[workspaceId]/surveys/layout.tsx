import { type ReactNode } from "react";
import { SurveysQueryClientProvider } from "./query-client-provider";

const SurveysLayout = ({ children }: { children: ReactNode }) => {
  return <SurveysQueryClientProvider>{children}</SurveysQueryClientProvider>;
};

export default SurveysLayout;
