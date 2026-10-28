import { type KeyboardEvent, useRef } from "react";

export type TabId = "review" | "try";

interface SurveyTabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "try", label: "Try it" },
];

export const tabId = (id: TabId): string => `sp-tab-${id}`;
export const panelId = (id: TabId): string => `sp-panel-${id}`;

/** A tab list with roving focus: arrows, Home and End move between the tabs, as the ARIA pattern asks. */
export const SurveyTabs = ({ active, onChange }: Readonly<SurveyTabsProps>) => {
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ review: null, try: null });

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const target = TABS[next];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div className="fb-tabs" role="tablist" aria-label="Survey preview">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[tab.id] = element;
          }}
          id={tabId(tab.id)}
          type="button"
          role="tab"
          className="fb-tab"
          aria-selected={tab.id === active}
          aria-controls={panelId(tab.id)}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
};
