"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useTeam } from "@/lib/teams";

export default function FormsPage({ params }) {
  const { form, isLoadingForm, isErrorForm } = useForm(params.formId, params.teamId);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(params.teamId);

  if (isLoadingForm || isLoadingTeam) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm || isErrorTeam) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          {form.label}
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
          </span>
        </h1>
      </header>
    </div>
  );
}
