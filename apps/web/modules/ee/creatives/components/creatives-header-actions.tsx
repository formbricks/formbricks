"use client";

import { NewCreativeDialog } from "./new-creative-dialog";

export const CreativesHeaderActions = ({
  workspaceId,
  isReadOnly,
  defaultLanguage,
}: Readonly<{ workspaceId: string; isReadOnly: boolean; defaultLanguage: string }>) => {
  if (isReadOnly) return null;
  return <NewCreativeDialog workspaceId={workspaceId} defaultLanguage={defaultLanguage} />;
};
