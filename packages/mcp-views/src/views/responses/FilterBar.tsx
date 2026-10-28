import { Button } from "../../shared/ui";
import { type Filters, type StatusFilter, isFiltered } from "./filters";
import type { SortBy } from "./types";

interface FilterBarProps {
  filters: Filters;
  problem: string | undefined;
  busy: boolean;
  onChange: (next: Filters) => void;
  onClear: () => void;
}

export const FilterBar = ({ filters, problem, busy, onChange, onClear }: Readonly<FilterBarProps>) => (
  <form className="rv-filters" aria-label="Filter responses" onSubmit={(event) => event.preventDefault()}>
    <label className="rv-field">
      <span className="rv-field-label">Status</span>
      <select
        className="rv-input"
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value as StatusFilter })}>
        <option value="all">All responses</option>
        <option value="finished">Finished</option>
        <option value="partial">Partial</option>
      </select>
    </label>
    <label className="rv-field">
      <span className="rv-field-label">From</span>
      <input
        className="rv-input"
        type="date"
        value={filters.from.day}
        max={filters.to.day || undefined}
        onChange={(event) => onChange({ ...filters, from: { day: event.target.value } })}
      />
    </label>
    <label className="rv-field">
      <span className="rv-field-label">To</span>
      <input
        className="rv-input"
        type="date"
        value={filters.to.day}
        min={filters.from.day || undefined}
        onChange={(event) => onChange({ ...filters, to: { day: event.target.value } })}
      />
    </label>
    <label className="rv-field">
      <span className="rv-field-label">Sort</span>
      <select
        className="rv-input"
        value={filters.sortBy}
        onChange={(event) => onChange({ ...filters, sortBy: event.target.value as SortBy })}>
        <option value="-createdAt">Newest first</option>
        <option value="createdAt">Oldest first</option>
      </select>
    </label>
    <Button onClick={onClear} disabled={busy || !isFiltered(filters)}>
      Clear filters
    </Button>
    {problem ? (
      <p className="rv-problem" role="alert">
        {problem}
      </p>
    ) : null}
  </form>
);
