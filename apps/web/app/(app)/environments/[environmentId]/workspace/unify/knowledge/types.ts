export type KnowledgeItemType = "link" | "note" | "file";

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title?: string;
  url?: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  size?: number; // Size in bytes
  createdAt: Date;
  indexedAt?: Date;
}

// Format file size to human readable string
export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
