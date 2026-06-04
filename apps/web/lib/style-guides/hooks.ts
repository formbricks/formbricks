"use client";

import { useEffect, useState } from "react";
import { AppliedStyleGuide } from "@/lib/style-guides/utils";

export function useActiveStyleGuide(workspaceId: string) {
  const [styleGuide, setStyleGuide] = useState<AppliedStyleGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStyleGuide() {
      try {
        const response = await fetch(`/api/v1/management/workspaces/${workspaceId}/active-style-guide`);
        if (response.ok) {
          const data = await response.json();
          setStyleGuide(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch style guide"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchStyleGuide();
  }, [workspaceId]);

  return { styleGuide, isLoading, error };
}

export function useStyleGuides(organizationId: string) {
  const [styleGuides, setStyleGuides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStyleGuides() {
      try {
        const response = await fetch(`/api/v1/management/organizations/${organizationId}/style-guides`);
        if (response.ok) {
          const data = await response.json();
          setStyleGuides(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch style guides"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchStyleGuides();
  }, [organizationId]);

  return { styleGuides, isLoading, error };
}
