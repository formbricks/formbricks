export const mockProjectId = "clt2h1ant000f08l36qmx2dy2";
export const mockLanguageId = "rp2di001zicbm3mk8je1ue9u";
export const mockLanguage = {
  id: mockLanguageId,
  code: "en",
  alias: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  projectId: mockProjectId,
};

export const mockLanguageUpdate = {
  alias: "en-US",
};

export const mockUpdatedLanguage = {
  ...mockLanguage,
  alias: "en-US",
};

export const mockLanguageInput = {
  code: "en",
  alias: null,
};
export const mockEnvironmentId = "clt2h31iz000h08l3acuwcqvp";
