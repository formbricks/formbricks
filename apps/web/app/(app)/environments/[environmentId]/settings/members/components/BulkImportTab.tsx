"use client";

import { UploadIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { ZInviteeMembers } from "@formbricks/types/invites";
import { Button } from "@formbricks/ui/Button";

enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}
interface MemberModalProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }[]) => void;
  canDoRoleManagement: boolean;
}

export default function BulkImportTab({ setOpen, onSubmit, canDoRoleManagement }: MemberModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCSVFile] = useState<File>();
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) {
      return;
    }
    const file = e.target.files[0];
    setCSVFile(file);
  };

  const onImport = () => {
    if (!csvFile) {
      return;
    }
    Papa.parse(csvFile, {
      skipEmptyLines: true,
      comments: "Full name,Email Address,Role",
      complete: (results: ParseResult<string[]>) => {
        const members = results.data.map((csv) => {
          const [name, email, role] = csv;

          return {
            name: name.trim(),
            email: email.trim(),
            role: canDoRoleManagement ? (role.trim().toLowerCase() as MembershipRole) : MembershipRole.Admin,
          };
        });
        try {
          ZInviteeMembers.parse(members);
          onSubmit(members);
          console.log(members);
        } catch (err) {
          console.error(err.message);
          toast.error("Please check the CSV file and make sure it is according to our format");
        }
        setOpen(false);
      },
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div
        className="flex h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-gray-300"
        onClick={() => fileInputRef.current?.click()}>
        <UploadIcon className="h-7 w-7 text-neutral-500" />
        <span className="text-sm text-neutral-500">{csvFile ? csvFile.name : "Click here to upload"}</span>
        <input onChange={onFileInputChange} type="file" ref={fileInputRef} accept=".csv" hidden />
      </div>
      <div className="flex justify-end pt-6">
        <div className="flex space-x-2">
          <Button variant="secondary">
            <Link
              download
              href="/sample-csv/formbricks-team-members-template.csv"
              target="_blank"
              rel="noopener noreferrer">
              Template
            </Link>
          </Button>
          <Button onClick={onImport} variant="darkCTA" disabled={!csvFile}>
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}
