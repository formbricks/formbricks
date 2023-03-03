"use client";

import { DataInSurvey, DataOutSurvey } from "./IntegrationSurveys";

export default function FormsPage({}) {
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">Integrations</h1>
      </header>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-700">Data-In: Pre-Segmentation</h2>
        <p className="text-slate-400">Sync cohorts of users to ask questions based on your analytics data.</p>
        <DataInSurvey />
      </div>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-700">Data-Out: User Profiles and CRM</h2>
        <p className="text-slate-400">Enrich user data on other platforms.</p>
        <DataOutSurvey />
      </div>
    </div>
  );
}
