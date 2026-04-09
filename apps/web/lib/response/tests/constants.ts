import { TEnvironment } from "@formbricks/types/environment";

export const mockId = "ars2tjk8hsi8oqk1uac00mo8";

export const constantsForTests = {
  uuid: "123e4567-e89b-12d3-a456-426614174000",
  browser: "Chrome",
  url: "https://www.example.com",
  boolean: true,
  text: "Abc12345",
  fullName: "Pavitr Prabhakar",
};

export const mockEnvironment: TEnvironment = {
  id: mockId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: mockId,
  appSetupCompleted: false,
};
