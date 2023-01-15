"use client";

import FormsList from "@/components/forms/FormsList";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForms } from "@/lib/forms";
import { useWorkspace } from "@/lib/workspaces";
import { useRouter } from "next/router";

export default function FormsPage({}) {
  const router = useRouter();
  const { isLoadingForms, isErrorForms } = useForms(router.query.workspaceId?.toString());
  const { workspace, isLoadingWorkspace, isErrorWorkspace } = useWorkspace(
    router.query.workspaceId?.toString()
  );

  if (isLoadingForms || isLoadingWorkspace) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForms || isErrorWorkspace) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Forms
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {workspace.name}
          </span>
        </h1>
      </header>
      <FormsList workspaceId={router.query.workspaceId} />
    </div>
  );
}
