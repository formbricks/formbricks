"use client";

import { SearchIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { semanticSearchFeedbackRecordsAction } from "../actions";
import type { TTopicsPreviewSearchResult } from "../actions";

const EXAMPLE_SEARCH_KEYS = [
  "workspace.unify.semantic_topics_example_slow_checkout",
  "workspace.unify.semantic_topics_example_pricing_complaints",
  "workspace.unify.semantic_topics_example_confusing_onboarding",
] as const;

interface TopicsSubtopicsPreviewProps {
  workspaceId: string;
  directoryMap: Record<string, string>;
}

export const TopicsSubtopicsPreview = ({
  workspaceId,
  directoryMap,
}: Readonly<TopicsSubtopicsPreviewProps>) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TTopicsPreviewSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);

  const hasDirectories = Object.keys(directoryMap).length > 0;

  const runSearch = async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || isSearching) return;

    setQuery(trimmedQuery);
    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    setUnavailableMessage(null);

    try {
      const response = await semanticSearchFeedbackRecordsAction({
        workspaceId,
        query: trimmedQuery,
        limit: 10,
        minScore: 0.7,
      });

      if (response?.data) {
        setResults(response.data.results);
        setUnavailableMessage(response.data.unavailable ? (response.data.unavailableMessage ?? "") : null);
      } else {
        setResults([]);
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.semantic_search_failed"));
      }
    } catch {
      setResults([]);
      setError(t("workspace.unify.semantic_search_failed"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    await runSearch(query);
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="topics-subtopics" />
      </PageHeader>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("workspace.unify.semantic_topics_preview_title")}
                </h2>
                <Badge text={t("common.preview")} type="gray" size="tiny" />
              </div>
              <p className="text-sm text-slate-600">
                {t("workspace.unify.semantic_topics_preview_description")}
              </p>
            </div>
          </div>

          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("workspace.unify.semantic_search_placeholder")}
              disabled={!hasDirectories || isSearching}
              aria-label={t("workspace.unify.semantic_search_input_label")}
            />
            <Button type="submit" disabled={!query.trim() || !hasDirectories} loading={isSearching}>
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
              {t("workspace.unify.search_feedback")}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{t("workspace.unify.try_searching_for")}</span>
            {EXAMPLE_SEARCH_KEYS.map((key) => {
              const label = t(key);
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!hasDirectories || isSearching}
                  onClick={() => runSearch(label)}>
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {!hasDirectories && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">{t("workspace.unify.semantic_search_no_directories")}</p>
            <Button className="mt-4" size="sm" asChild>
              <Link href={`/workspaces/${workspaceId}/feedback-sources`}>
                {t("workspace.unify.manage_feedback_sources")}
              </Link>
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {unavailableMessage !== null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("workspace.unify.semantic_search_unavailable")}
          </div>
        )}

        {hasSearched && !isSearching && !error && unavailableMessage === null && results.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">{t("workspace.unify.semantic_search_no_results")}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">
                {t("workspace.unify.semantic_search_results_count", { count: results.length })}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {results.map((result) => (
                <div key={`${result.tenant_id}-${result.feedback_record_id}`} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge text={result.directory_name} type="gray" size="tiny" />
                    <span className="text-xs text-slate-500">
                      {t("workspace.unify.semantic_search_relevance", {
                        score: Math.round(result.score * 100),
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {result.field_label || t("workspace.unify.field_label")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {result.value_text || t("workspace.unify.semantic_search_missing_text")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContentWrapper>
  );
};
