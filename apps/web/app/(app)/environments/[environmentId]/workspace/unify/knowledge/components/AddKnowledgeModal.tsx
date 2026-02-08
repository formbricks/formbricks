"use client";

import { FileTextIcon, LinkIcon, PlusIcon, StickyNoteIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import type { TAllowedFileExtension } from "@formbricks/types/storage";
import { cn } from "@/lib/cn";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import type { KnowledgeItem } from "../types";

const DOC_EXTENSIONS: TAllowedFileExtension[] = ["pdf", "doc", "docx", "txt", "csv"];
const MAX_DOC_SIZE_MB = 5;

interface AddKnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: KnowledgeItem) => void;
  environmentId: string;
  isStorageConfigured: boolean;
}

export function AddKnowledgeModal({
  open,
  onOpenChange,
  onAdd,
  environmentId,
  isStorageConfigured,
}: AddKnowledgeModalProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setLinkUrl("");
    setLinkTitle("");
    setNoteContent("");
    setUploadedDocUrl(null);
    setUploadedFileName(null);
  };

  const handleDocUpload = async (files: File[]) => {
    if (!isStorageConfigured) {
      toast.error("File storage is not configured.");
      return;
    }
    const file = files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadedDocUrl(null);
    setUploadedFileName(null);
    const result = await handleFileUpload(file, environmentId, DOC_EXTENSIONS);
    setIsUploading(false);
    if (result.error) {
      toast.error("Upload failed. Please try again.");
      return;
    }
    setUploadedDocUrl(result.url);
    setUploadedFileName(file.name);
    toast.success("Document uploaded. Click Add to save.");
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      toast.error("Please enter a URL.");
      return;
    }
    const now = new Date();
    onAdd({
      id: crypto.randomUUID(),
      type: "link",
      title: linkTitle.trim() || undefined,
      url: linkUrl.trim(),
      size: linkUrl.trim().length * 100, // Simulated size for links
      createdAt: now,
      indexedAt: now, // Links are indexed immediately
    });
    resetForm();
    onOpenChange(false);
    toast.success("Link added.");
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error("Please enter some text.");
      return;
    }
    const now = new Date();
    onAdd({
      id: crypto.randomUUID(),
      type: "note",
      content: noteContent.trim(),
      size: new Blob([noteContent.trim()]).size,
      createdAt: now,
      indexedAt: now, // Notes are indexed immediately
    });
    resetForm();
    onOpenChange(false);
    toast.success("Note added.");
  };

  const handleAddFile = () => {
    if (!uploadedDocUrl) {
      toast.error("Please upload a document first.");
      return;
    }
    const now = new Date();
    onAdd({
      id: crypto.randomUUID(),
      type: "file",
      title: uploadedFileName ?? undefined,
      fileUrl: uploadedDocUrl,
      fileName: uploadedFileName ?? undefined,
      size: Math.floor(Math.random() * 500000) + 10000, // Simulated file size (10KB - 500KB)
      createdAt: now,
      indexedAt: undefined, // Files take time to index - will show as "Pending"
    });
    resetForm();
    onOpenChange(false);
    toast.success("Document added.");
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) handleDocUpload(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Button onClick={() => onOpenChange(true)} size="sm">
        Add knowledge
        <PlusIcon className="ml-2 size-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) resetForm();
          onOpenChange(o);
        }}>
        <DialogContent className="sm:max-w-lg" disableCloseOnOutsideClick>
          <DialogHeader>
            <PlusIcon className="size-5 text-slate-600" />
            <DialogTitle>Add knowledge</DialogTitle>
            <DialogDescription>Add knowledge via a link, document upload, or a text note.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Tabs defaultValue="link" className="w-full">
              <TabsList width="fill" className="mb-4 w-full">
                <TabsTrigger value="link" icon={<LinkIcon className="size-4" />}>
                  Link
                </TabsTrigger>
                <TabsTrigger value="upload" icon={<FileTextIcon className="size-4" />}>
                  Upload doc
                </TabsTrigger>
                <TabsTrigger value="note" icon={<StickyNoteIcon className="size-4" />}>
                  Note
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="link-title">Title (optional)</Label>
                  <Input
                    id="link-title"
                    placeholder="e.g. Product docs"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-url">URL</Label>
                  <Input
                    id="link-url"
                    type="url"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleAddLink} size="sm">
                  Add link
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <Uploader
                  id="knowledge-doc-modal"
                  name="knowledge-doc-modal"
                  uploaderClassName="h-32 w-full"
                  allowedFileExtensions={DOC_EXTENSIONS}
                  multiple={false}
                  handleUpload={handleDocUpload}
                  handleDrop={handleDrop}
                  handleDragOver={handleDragOver}
                  isStorageConfigured={isStorageConfigured}
                />
                <p className="text-xs text-slate-500">PDF, Word, text, or CSV. Max {MAX_DOC_SIZE_MB} MB.</p>
                {isUploading && <p className="text-sm text-slate-600">Uploading…</p>}
                {uploadedDocUrl && (
                  <p className="text-sm text-slate-700">
                    Ready: <span className="font-medium">{uploadedFileName ?? uploadedDocUrl}</span>
                  </p>
                )}
                <Button type="button" onClick={handleAddFile} size="sm" disabled={!uploadedDocUrl}>
                  Add document
                </Button>
              </TabsContent>

              <TabsContent value="note" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="knowledge-note-modal">Note</Label>
                  <textarea
                    id="knowledge-note-modal"
                    rows={5}
                    placeholder="Paste or type knowledge content here..."
                    className={cn(
                      "focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleAddNote} size="sm">
                  Add note
                </Button>
              </TabsContent>
            </Tabs>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
