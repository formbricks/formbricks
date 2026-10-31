"use client";

import { type ReactNode, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";

/**
 * Labels for members a renderer cannot name on its own — Embedded Data fields, whose member is a hash
 * of the field name (ENG-2848). The server sends them with the rows (`memberLabels`); a renderer
 * outside a provider simply has none, which is every chart without Embedded Data.
 */
const MemberLabelsContext = createContext<Readonly<Record<string, string>> | undefined>(undefined);

export function MemberLabelsProvider({
  labels,
  children,
}: Readonly<{ labels?: Record<string, string>; children: ReactNode }>) {
  return <MemberLabelsContext.Provider value={labels}>{children}</MemberLabelsContext.Provider>;
}

/** `formatCubeColumnHeader`, with the provided member labels taking precedence. */
export function useColumnHeader(): (key: string) => string {
  const labels = useContext(MemberLabelsContext);
  const { t } = useTranslation();
  return (key) => labels?.[key] ?? formatCubeColumnHeader(key, t);
}
