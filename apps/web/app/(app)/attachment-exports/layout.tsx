import { type ReactNode } from "react";
import { AttachmentExportsQueryClientProvider } from "./query-client-provider";

const AttachmentExportsLayout = ({ children }: { readonly children: ReactNode }) => {
  return <AttachmentExportsQueryClientProvider>{children}</AttachmentExportsQueryClientProvider>;
};

export default AttachmentExportsLayout;
