import { type ReactNode } from "react";
import { TagsQueryClientProvider } from "./query-client-provider";

const TagsSettingsLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <TagsQueryClientProvider>{children}</TagsQueryClientProvider>;
};

export default TagsSettingsLayout;
