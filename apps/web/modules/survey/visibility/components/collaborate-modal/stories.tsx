import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import type { TSurveyVisibilityState } from "@/modules/survey/visibility/types";
import { CollaborateModal } from "./index";

const SURVEY_ID = "story-survey";

const baseState: TSurveyVisibilityState = {
  id: SURVEY_ID,
  visibility: "restricted",
  owner: { name: "Ada Lovelace" },
  access: { via: "owner", canManageVisibility: true },
  blockers: [],
  impact: { memberCount: 12, responseCount: 348 },
  pending: null,
  version: 1,
  allowedTargets: ["restricted", "workspace"],
};

/** Seeds the visibility query so the story renders without a backend. */
const withVisibilityState = (state: TSurveyVisibilityState | null): Decorator => {
  const WithVisibilityState: Decorator = (Story) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    if (state) queryClient.setQueryData(surveyKeys.visibility(SURVEY_ID), state);
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
  return WithVisibilityState;
};

const meta: Meta<typeof CollaborateModal> = {
  title: "Survey/Visibility/CollaborateModal",
  component: CollaborateModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Scope 1 of Collaborate: pick Restricted or Visible to the workspace. Restricting opens the confirmation; making visible saves directly.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the modal is open",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    setOpen: { action: "setOpen", table: { category: "Behavior" } },
    onVisibilityChanged: { action: "visibilityChanged", table: { category: "Behavior" } },
    onVisibilityNotEnabled: { action: "visibilityNotEnabled", table: { category: "Behavior" } },
    listQueryKey: { control: false, table: { category: "Behavior" } },
    surveyId: { control: false, table: { category: "Behavior", type: { summary: "string" } } },
    surveyName: {
      control: "text",
      description: "Shown under the title",
      table: { category: "Content", type: { summary: "string" } },
    },
    workspaceName: {
      control: "text",
      description: "The workspace named in the options",
      table: { category: "Content", type: { summary: "string" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CollaborateModal>;

const baseArgs = {
  open: true,
  setOpen: () => undefined,
  onVisibilityNotEnabled: () => undefined,
  surveyId: SURVEY_ID,
  surveyName: "Customer satisfaction Q3",
  workspaceName: "Acme",
};

export const Default: Story = { args: baseArgs, decorators: [withVisibilityState(baseState)] };

export const VisibleToWorkspace: Story = {
  args: baseArgs,
  decorators: [
    withVisibilityState({
      ...baseState,
      visibility: "workspace",
      access: { via: "workspace", canManageVisibility: true },
    }),
  ],
};

export const ManagerViewingSomeoneElsesSurvey: Story = {
  args: baseArgs,
  decorators: [
    withVisibilityState({ ...baseState, access: { via: "organizationRole", canManageVisibility: true } }),
  ],
};

export const AuthorGoneCannotRestrict: Story = {
  args: baseArgs,
  decorators: [
    withVisibilityState({
      ...baseState,
      visibility: "workspace",
      owner: null,
      access: { via: "workspace", canManageVisibility: true },
      allowedTargets: ["workspace"],
    }),
  ],
};

export const PendingGrant: Story = {
  args: baseArgs,
  decorators: [withVisibilityState({ ...baseState, pending: "workspace", version: 2 })],
};

export const PendingRestriction: Story = {
  args: baseArgs,
  decorators: [
    withVisibilityState({ ...baseState, visibility: "workspace", pending: "restricted", version: 2 }),
  ],
};

export const Loading: Story = { args: baseArgs, decorators: [withVisibilityState(null)] };
