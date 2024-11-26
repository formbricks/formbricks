"use client";

import { UploadIcon, XIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { ZInvitees } from "@formbricks/types/invites";
import { Alert, AlertDescription } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { MembershipRole } from "./AddMemberModal";

interface BulkInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }[]) => void;
  canDoRoleManagement: boolean;
}

export const BulkInviteTab = ({ setOpen, onSubmit, canDoRoleManagement }: BulkInviteTabProps) => {
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
      comments: "Full Name,Email Address,Role",
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
          ZInvitees.parse(members);
          onSubmit(members);
        } catch (err) {
          console.error(err.message);
          toast.error("Please check the CSV file and make sure it is according to our format");
        }
        setOpen(false);
      },
    });
  };

  const removeFile = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation();
    setCSVFile(undefined);
    // Reset the file input value to ensure it can detect the same file if re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="relative flex h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100"
        onClick={() => fileInputRef.current?.click()}>
        {csvFile ? (
          <XIcon
            className="absolute right-4 top-4 h-6 w-6 cursor-pointer text-neutral-500"
            onClick={removeFile}
          />
        ) : (
          <UploadIcon className="h-6 w-6 text-neutral-500" />
        )}
        <span className="text-sm text-neutral-500">{csvFile ? csvFile.name : "Click here to upload"}</span>
        <input onChange={onFileInputChange} type="file" ref={fileInputRef} accept=".csv" hidden />
      </div>
      <div>
        {!canDoRoleManagement && (
          <Alert variant="error" className="mt-1.5 flex items-start bg-slate-50">
            <AlertDescription className="ml-2">
              <p className="text-sm">
                <strong>Warning: </strong> Please note that on the Free Plan, all organization members are
                automatically assigned the &quot;Admin&quot; role regardless of the role specified in the CSV
                file.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex justify-end">
        <div className="flex space-x-2">
          <Link
            download
            href="/sample-csv/formbricks-organization-members-template.csv"
            target="_blank"
            rel="noopener noreferrer">
            <Button variant="minimal" size="sm">
              Download CSV template
            </Button>
          </Link>
          <Button onClick={onImport} size="sm" disabled={!csvFile}>
            Import
          </Button>
        </div>
      </div>
    </div>
  );
};
