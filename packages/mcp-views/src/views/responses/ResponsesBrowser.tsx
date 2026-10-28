import type { App } from "@modelcontextprotocol/ext-apps";
import { useRef, useState } from "react";
import { Button, Loading } from "../../shared/ui";
import { DetailPanel } from "./DetailPanel";
import { FilterBar } from "./FilterBar";
import { ResponsesTable } from "./ResponsesTable";
import { isFiltered } from "./filters";
import { type Display, formatNumber } from "./format";
import { describeCount } from "./state";
import type { ShowResponsesData } from "./types";
import { useResponsesList } from "./use-responses-list";

interface ResponsesBrowserProps {
  app: App | null;
  initial: ShowResponsesData;
  display: Display;
}

export const ResponsesBrowser = ({ app, initial, display }: Readonly<ResponsesBrowserProps>) => {
  const { state, filters, filterProblem, changeFilters, clearFilters, loadMore, retry } = useResponsesList(
    app,
    initial,
    display.timeZone
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const lastOpened = useRef<string | undefined>(undefined);

  const selectedRow = state.rows.find((row) => row.id === selectedId);
  const refreshing = state.phase === "refreshing";
  const empty = state.rows.length === 0 && !refreshing && !state.error;

  const open = (id: string) => {
    lastOpened.current = id;
    setSelectedId(id);
  };
  const close = () => {
    setSelectedId(undefined);
    const id = lastOpened.current;
    // Hand focus back to the row the panel was opened from.
    if (id) requestAnimationFrame(() => document.getElementById(`rv-open-${id}`)?.focus());
  };

  const countText = describeCount(state.rows.length, state.total, (n) => formatNumber(n, display));

  return (
    <div className="fb-stack rv-root">
      <header className="fb-row fb-spread">
        <div>
          <h1 className="fb-title">{initial.survey.name}</h1>
          <p className="fb-muted" role="status">
            {refreshing ? "Updating…" : countText}
          </p>
        </div>
      </header>

      <FilterBar
        filters={filters}
        problem={filterProblem}
        busy={refreshing}
        onChange={changeFilters}
        onClear={clearFilters}
      />

      {state.error && state.rows.length === 0 ? (
        <div className="fb-notice fb-notice-danger rv-state" role="alert">
          <p>{state.error}</p>
          <Button onClick={retry}>Try again</Button>
        </div>
      ) : null}

      {refreshing && state.rows.length === 0 ? <Loading label="Loading responses…" /> : null}

      {empty ? (
        <div className="fb-notice rv-state rv-empty">
          <p className="fb-title">
            {isFiltered(filters) ? "No responses match these filters" : "No responses yet"}
          </p>
          <p className="fb-muted">
            {isFiltered(filters)
              ? "Try a wider date range or a different status."
              : "Responses to this survey will show up here as people submit them."}
          </p>
          {isFiltered(filters) ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        </div>
      ) : null}

      {state.rows.length > 0 ? (
        <div className={selectedRow ? "rv-layout rv-has-detail" : "rv-layout"}>
          <div className="rv-list fb-stack">
            <ResponsesTable
              surveyName={initial.survey.name}
              columns={state.columns}
              rows={state.rows}
              display={display}
              selectedId={selectedRow?.id}
              busy={refreshing}
              onOpen={open}
            />
            {state.error ? (
              <div className="fb-notice fb-notice-danger rv-state" role="alert">
                <p>{state.error}</p>
                <Button onClick={retry}>Try again</Button>
              </div>
            ) : null}
            {state.nextCursor ? (
              <div className="fb-row">
                <Button onClick={loadMore} disabled={state.phase !== "idle"}>
                  {state.phase === "loadingMore" ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : (
              <p className="fb-faint">That is every response that matches.</p>
            )}
          </div>
          {selectedRow ? (
            <DetailPanel
              key={selectedRow.id}
              app={app}
              responseId={selectedRow.id}
              createdAt={selectedRow.createdAt}
              display={display}
              onClose={close}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
