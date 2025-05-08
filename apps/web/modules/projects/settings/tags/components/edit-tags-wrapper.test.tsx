import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TTag, TTagsCount } from "@formbricks/types/tags";
import { EditTagsWrapper } from "./edit-tags-wrapper";

vi.mock("@/modules/projects/settings/tags/components/single-tag", () => ({
  SingleTag: (props: any) => <div data-testid={`single-tag-${props.tagId}`}>{props.tagName}</div>,
}));
vi.mock("@/modules/ui/components/empty-space-filler", () => ({
  EmptySpaceFiller: () => <div data-testid="empty-space-filler" />,
}));

describe("EditTagsWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  const environment: TEnvironment = {
    id: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "production",
    projectId: "p1",
    appSetupCompleted: true,
  };

  const tags: TTag[] = [
    { id: "tag1", createdAt: new Date(), updatedAt: new Date(), name: "Tag 1", environmentId: "env1" },
    { id: "tag2", createdAt: new Date(), updatedAt: new Date(), name: "Tag 2", environmentId: "env1" },
  ];

  const tagsCount: TTagsCount = [
    { tagId: "tag1", count: 5 },
    { tagId: "tag2", count: 0 },
  ];

  test("renders table headers and actions column if not readOnly", () => {
    render(
      <EditTagsWrapper
        environment={environment}
        environmentTags={tags}
        environmentTagsCount={tagsCount}
        isReadOnly={false}
      />
    );
    expect(screen.getByText("environments.project.tags.tag")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.count")).toBeInTheDocument();
    expect(screen.getByText("common.actions")).toBeInTheDocument();
  });

  test("does not render actions column if readOnly", () => {
    render(
      <EditTagsWrapper
        environment={environment}
        environmentTags={tags}
        environmentTagsCount={tagsCount}
        isReadOnly={true}
      />
    );
    expect(screen.queryByText("common.actions")).not.toBeInTheDocument();
  });

  test("renders EmptySpaceFiller if no tags", () => {
    render(
      <EditTagsWrapper
        environment={environment}
        environmentTags={[]}
        environmentTagsCount={[]}
        isReadOnly={false}
      />
    );
    expect(screen.getByTestId("empty-space-filler")).toBeInTheDocument();
  });

  test("renders SingleTag for each tag", () => {
    render(
      <EditTagsWrapper
        environment={environment}
        environmentTags={tags}
        environmentTagsCount={tagsCount}
        isReadOnly={false}
      />
    );
    expect(screen.getByTestId("single-tag-tag1")).toHaveTextContent("Tag 1");
    expect(screen.getByTestId("single-tag-tag2")).toHaveTextContent("Tag 2");
  });
});
