"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import { useForms } from "@/lib/forms";
import { useTeam } from "@/lib/teams";
import FormsList from "./FormsList";

export default function FormsPage({ params }) {
  const { forms, isLoadingForms, isErrorForms } = useForms(params.teamId);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(params.teamId);

  if (isLoadingForms || isLoadingTeam) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForms || isErrorTeam) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Forms
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
          </span>
        </h1>
      </header>
      <FormsList teamId={params.teamId} />
    </div>
  );
}
