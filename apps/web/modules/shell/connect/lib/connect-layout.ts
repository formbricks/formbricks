/**
 * What the Connect your agent page shows, as a function of how many agents are connected.
 *
 * Two parts: connecting an agent (the per-client snippets) and setting the account up with it (the paste
 * prompt that points at the Setup guide). With no agent connected, connecting comes first and setup is
 * visible but secondary. Once one is connected, setup is the primary action and connecting another
 * agent stays reachable below it.
 */
export type TConnectSectionId = "connect" | "setup";

export interface TConnectSection {
  id: TConnectSectionId;
  /** The step number to show, or `null` when the sections are not a sequence (an agent is connected). */
  step: 1 | 2 | null;
  emphasis: "primary" | "secondary";
}

export interface TConnectLayout {
  hasAgent: boolean;
  sections: [TConnectSection, TConnectSection];
}

export const getConnectLayout = (connectionCount: number): TConnectLayout => {
  if (connectionCount > 0) {
    return {
      hasAgent: true,
      sections: [
        { id: "setup", step: null, emphasis: "primary" },
        { id: "connect", step: null, emphasis: "secondary" },
      ],
    };
  }

  return {
    hasAgent: false,
    sections: [
      { id: "connect", step: 1, emphasis: "primary" },
      { id: "setup", step: 2, emphasis: "secondary" },
    ],
  };
};
