"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import GoBackButton from "@/components/shared/GoBackButton";
import { TPersonDetailedAttribute } from "@formbricks/types/v1/people";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { deletePerson } from "@formbricks/lib/services/person";

export default function HeadingSection({
  environmentId,
  personEmail,
  personId,
}: {
  environmentId: string;
  personEmail: TPersonDetailedAttribute | undefined;
  personId: string;
}) {
  const router = useRouter();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const handleDeletePerson = async () => {
    await deletePerson(personId);
    router.push(`/environments/${environmentId}/people`);
    toast.success("Person deleted successfully.");
  };

  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
        <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
          {personEmail ? <span>{personEmail.value}</span> : <span>{personId}</span>}
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setDeleteDialogOpen(true);
            }}>
            <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-700" />
          </button>
        </div>
      </div>
      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat="person"
        onDelete={handleDeletePerson}
      />
    </>
  );
}
