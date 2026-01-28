"use client";

import {
  ChevronRightIcon,
  LightbulbIcon,
  MessageCircleIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { H4, Small } from "@/modules/ui/components/typography";
import type { TaxonomyDetail, TaxonomyThemeItem } from "../types";

const THEME_COLORS: Record<string, string> = {
  red: "bg-red-400",
  orange: "bg-orange-400",
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  slate: "bg-slate-400",
};;

function getThemeIcon(icon?: TaxonomyThemeItem["icon"]) {
  switch (icon) {
    case "warning":
      return <TriangleAlertIcon className="size-4 text-amber-500" />;
    case "wrench":
      return <WrenchIcon className="size-4 text-slate-500" />;
    case "message-circle":
      return <MessageCircleIcon className="size-4 text-slate-500" />;
    case "lightbulb":
      return <LightbulbIcon className="size-4 text-amber-500" />;
    default:
      return <MessageCircleIcon className="size-4 text-slate-400" />;
  }
}

interface ThemeItemRowProps {
  item: TaxonomyThemeItem;
  depth?: number;
  themeSearch: string;
}

function ThemeItemRow({ item, depth = 0, themeSearch }: ThemeItemRowProps) {
  const [expanded, setExpanded] = useState(depth === 0 && (item.children?.length ?? 0) > 0);
  const hasChildren = item.children && item.children.length > 0;
  const labelLower = item.label.toLowerCase();
  const matchesSearch =
    !themeSearch.trim() || labelLower.includes(themeSearch.trim().toLowerCase());
  const childMatches =
    hasChildren &&
    item.children!.some((c) =>
      c.label.toLowerCase().includes(themeSearch.trim().toLowerCase())
    );
  const show = matchesSearch || childMatches;

  if (!show) return null;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 text-sm",
          depth === 0 ? "font-medium text-slate-800" : "text-slate-600"
        )}
        style={{ paddingLeft: depth * 16 + 4 }}>
        <button
          type="button"
          onClick={() => hasChildren && setExpanded(!expanded)}
          className="flex shrink-0 items-center justify-center text-slate-400 hover:text-slate-600">
          {hasChildren ? (
            <ChevronRightIcon
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
            />
          ) : (
            <span className="w-4" />
          )}
        </button>
        {getThemeIcon(item.icon)}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Small color="muted" className="shrink-0">
          {item.count}
        </Small>
      </div>
      {hasChildren && expanded && (
        <div className="border-l border-slate-200 pl-2">
          {item.children!.map((child) => (
            <ThemeItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              themeSearch={themeSearch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaxonomyDetailPanelProps {
  detail: TaxonomyDetail | null;
}

export function TaxonomyDetailPanel({ detail }: TaxonomyDetailPanelProps) {
  const [themeSearch, setThemeSearch] = useState("");

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Small color="muted">Select a Level 3 keyword to view details.</Small>
        </div>
      </div>
    );
  }

  const totalThemes = detail.themes.reduce((s, t) => s + t.count, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 overflow-y-auto p-4">
        <div className="border-b border-slate-200 pb-4">
          <H4 className="mb-1">{detail.keywordName}</H4>
          <div className="flex items-center gap-2">
            <Small color="muted">{detail.count} responses</Small>
            <button
              type="button"
              className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline">
              View all →
            </button>
          </div>
        </div>

        <div>
          <H4 className="mb-1 text-sm">Description</H4>
          <Small color="muted" className="leading-relaxed">
            {detail.description}
          </Small>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <H4 className="text-sm">{detail.themes.length} themes</H4>
            <div className="flex h-2 flex-1 max-w-[120px] overflow-hidden rounded-full bg-slate-100">
              {detail.themes.map((t) => (
                <div
                  key={t.id}
                  className={cn(THEME_COLORS[t.color] ?? "bg-slate-400")}
                  style={{
                    width: totalThemes ? `${(t.count / totalThemes) * 100}%` : "0%",
                  }}
                  title={t.label}
                />
              ))}
            </div>
          </div>
          <Input
            placeholder="Search themes"
            value={themeSearch}
            onChange={(e) => setThemeSearch(e.target.value)}
            className="mb-3 h-9 text-sm"
          />
          <div className="space-y-0.5">
            {detail.themeItems.map((item) => (
              <ThemeItemRow key={item.id} item={item} themeSearch={themeSearch} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
