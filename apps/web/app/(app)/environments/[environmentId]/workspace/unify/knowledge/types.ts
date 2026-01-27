export type KnowledgeItemType = "link" | "note" | "file";

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title?: string;
  url?: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
}
