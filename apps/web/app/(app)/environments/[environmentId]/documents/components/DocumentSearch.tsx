"use client";

import { useState } from "react";
import { TDocument } from "@formbricks/types/documents";
import { Button } from "@formbricks/ui/Button";
import { Card } from "@formbricks/ui/Card";
import { Input } from "@formbricks/ui/Input";
import { searchDocumentsAction } from "../actions";

interface DocumentSearchProps {
  environmentId: string;
}

export const DocumentSearch = ({ environmentId }: DocumentSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [documents, setDocuments] = useState<TDocument[]>([]);

  const searchDocuments = async () => {
    const documents = await searchDocumentsAction({ environmentId, searchTerm });
    if (documents?.data) {
      setDocuments(documents.data);
    } else {
      console.error(documents);
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          searchDocuments();
        }}
        className="flex w-full space-x-2">
        <Input
          placeholder="What are users thinking the performance of my app?"
          value={searchTerm}
          onChange={(v) => setSearchTerm(v.target.value)}
        />
        <Button className="h-10">Search</Button>
      </form>
      <div className="flex-col space-y-4">
        {documents.map((document) => (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="whitespace-pre-wrap px-4 py-5 sm:p-6">
              <p>{document.text}</p>
              <hr className="my-4 text-slate-300" />
              <p className="text-xs">Survey Response</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
