import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@formbricks/database";
import { StyleGuideCreate } from "@formbricks/types/style-guide";
import { styleGuideService } from "./style-guide";

describe("StyleGuideService", () => {
  let organizationId: string;
  let workspaceId: string;
  let styleGuideId: string;

  beforeAll(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: "Test Org for StyleGuide",
      },
    });
    organizationId = org.id;

    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace",
        organizationId,
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.workspace.deleteMany({
      where: { organizationId },
    });
    await prisma.organization.delete({
      where: { id: organizationId },
    });
  });

  it("should create a style guide", async () => {
    const data: StyleGuideCreate = {
      name: "Test Brand Kit",
      organizationId,
      brandColor: "#FF0000",
      accentColor: "#0000FF",
      fontSize: "16px",
      fontFamily: "Arial",
      borderRadius: "8px",
      version: "1.0.0",
      authors: "Test Team",
    };

    const styleGuide = await styleGuideService.create(data);
    styleGuideId = styleGuide.id;

    expect(styleGuide).toBeDefined();
    expect(styleGuide.name).toBe("Test Brand Kit");
    expect(styleGuide.brandColor).toBe("#FF0000");
    expect(styleGuide.organizationId).toBe(organizationId);
  });

  it("should retrieve a style guide by ID", async () => {
    const styleGuide = await styleGuideService.findById(styleGuideId);

    expect(styleGuide).toBeDefined();
    expect(styleGuide?.id).toBe(styleGuideId);
    expect(styleGuide?.name).toBe("Test Brand Kit");
  });

  it("should update a style guide", async () => {
    const updated = await styleGuideService.update(styleGuideId, {
      name: "Updated Brand Kit",
      brandColor: "#00FF00",
      version: "1.1.0",
    });

    expect(updated.name).toBe("Updated Brand Kit");
    expect(updated.brandColor).toBe("#00FF00");
    expect(updated.version).toBe("1.1.0");
  });

  it("should list style guides for organization", async () => {
    // Create another style guide
    await styleGuideService.create({
      name: "Second Brand Kit",
      organizationId,
      brandColor: "#FFFF00",
    });

    const styleGuides = await styleGuideService.findByOrganizationId(organizationId);

    expect(styleGuides.length).toBeGreaterThanOrEqual(2);
    expect(styleGuides.some((sg) => sg.name === "Updated Brand Kit")).toBe(true);
  });

  it("should enable style guide for workspace", async () => {
    const updated = await styleGuideService.enableForWorkspace(styleGuideId, workspaceId);
    const config = updated.workspaceConfig as Record<string, boolean>;

    expect(config[workspaceId]).toBe(true);
  });

  it("should disable style guide for workspace", async () => {
    const updated = await styleGuideService.disableForWorkspace(styleGuideId, workspaceId);
    const config = updated.workspaceConfig as Record<string, boolean>;

    expect(config[workspaceId]).toBe(false);
  });

  it("should set active style guide for workspace", async () => {
    const updated = await styleGuideService.setActiveForWorkspace(workspaceId, styleGuideId);

    expect(updated.activeStyleGuideId).toBe(styleGuideId);
  });

  it("should delete a style guide", async () => {
    // Create a temporary style guide to delete
    const temp = await styleGuideService.create({
      name: "To Delete",
      organizationId,
    });

    await styleGuideService.delete(temp.id);

    const deleted = await styleGuideService.findById(temp.id);
    expect(deleted).toBeNull();
  });
});
