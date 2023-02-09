"use client";

import FormsList from "@/components/forms/FormsList";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForms } from "@/lib/forms";
import { useOrganisation } from "@/lib/organisations";
import { useRouter } from "next/router";

export default function FormsPage({}) {
  const router = useRouter();
  const { isLoadingForms, isErrorForms } = useForms(router.query.organisationId?.toString());
  const { organisation, isLoadingOrganisation, isErrorOrganisation } = useOrganisation(
    router.query.organisationId?.toString()
  );

  if (isLoadingForms || isLoadingOrganisation) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForms || isErrorOrganisation) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">
          Forms
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {organisation.name}
          </span>
        </h1>
      </header>
      <FormsList organisationId={router.query.organisationId} />
    </div>
  );
}
