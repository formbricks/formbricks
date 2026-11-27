import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ArchiveSurveyRetentionWarning } from "./archive-survey-retention-warning";

const mocks = vi.hoisted(() => ({ useSurveyRetention: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => (values ? `${key} ${JSON.stringify(values)}` : key),
    i18n: { resolvedLanguage: "en-US", language: "en-US" },
  }),
}));

vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useOrganization: () => ({ organization: { displayTimeZone: "Europe/Berlin" } }),
}));

vi.mock("../../hooks/use-survey-retention", () => ({ useSurveyRetention: mocks.useSurveyRetention }));

const exemption = (until: string, revokedAt: string | null = null) => ({
  id: `clexm_${until}`,
  surveyId: "clsrv",
  surveyName: "Site visit",
  workspaceId: "clwsp",
  policy: "surveys" as const,
  until,
  source: "manual" as const,
  reason: "Audit",
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  revokedAt,
});

const retention = (exemptions: ReturnType<typeof exemption>[]) => ({
  data: { governed: true, policies: [], exemptions },
  isPending: false,
  isError: false,
});

const DEFAULT_COPY = "workspace.surveys.archive_survey_warning";

describe("ArchiveSurveyRetentionWarning", () => {
  afterEach(() => {
    cleanup();
    mocks.useSurveyRetention.mockReset();
  });

  test("states when the exemption ends for a held survey, the latest end when several hold it", () => {
    mocks.useSurveyRetention.mockReturnValue(
      retention([exemption("2099-03-31T12:00:00.000Z"), exemption("2099-06-30T12:00:00.000Z")])
    );

    render(<ArchiveSurveyRetentionWarning surveyId="clsrv" />);

    expect(mocks.useSurveyRetention).toHaveBeenCalledWith({ surveyId: "clsrv" });
    expect(
      screen.getByText('workspace.surveys.archive_survey_warning_exempt {"date":"Jun 30, 2099"}')
    ).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_COPY)).not.toBeInTheDocument();
  });

  test("keeps today's text for a survey with no exemption, or only a revoked or expired one", () => {
    mocks.useSurveyRetention.mockReturnValue(
      retention([
        exemption("2099-03-31T12:00:00.000Z", "2020-01-01T00:00:00.000Z"),
        exemption("2020-03-31T12:00:00.000Z"),
      ])
    );
    render(<ArchiveSurveyRetentionWarning surveyId="clsrv" />);
    expect(screen.getByText(DEFAULT_COPY)).toBeInTheDocument();
  });

  test("keeps today's text while the retention loads or when it fails", () => {
    mocks.useSurveyRetention.mockReturnValue({ data: undefined, isPending: true, isError: false });
    const { rerender } = render(<ArchiveSurveyRetentionWarning surveyId="clsrv" />);
    expect(screen.getByText(DEFAULT_COPY)).toBeInTheDocument();

    mocks.useSurveyRetention.mockReturnValue({ data: undefined, isPending: false, isError: true });
    rerender(<ArchiveSurveyRetentionWarning surveyId="clsrv" />);
    expect(screen.getByText(DEFAULT_COPY)).toBeInTheDocument();
  });
});
