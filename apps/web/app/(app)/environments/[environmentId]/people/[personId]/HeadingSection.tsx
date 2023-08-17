"use client";

import { GoBackButton, DeleteDialog } from "@formbricks/ui";
import { deletePersonAction } from "./actions";
import { TPerson } from "@formbricks/types/v1/people";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function HeadingSection({
  environmentId,
  person,
}: {
  environmentId: string;
  person: TPerson;
}) {
  const router = useRouter();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const handleDeletePerson = async () => {
    try {
      setIsDeletingPerson(true);
      await deletePersonAction(person.id);
      router.push(`/environments/${environmentId}/people`);
      toast.success("Person deleted successfully.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeletingPerson(false);
    }
  };

  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
        <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
          <span>{person.attributes.email || person.id}</span>
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
        isDeleting={isDeletingPerson}
      />
    </>
  );
}
