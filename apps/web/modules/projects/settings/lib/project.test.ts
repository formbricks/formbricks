import { environmentCache } from "@/lib/environment/cache";
import { createEnvironment } from "@/lib/environment/service";
import { projectCache } from "@/lib/project/cache";
import { deleteLocalFilesByEnvironmentId, deleteS3FilesByEnvironmentId } from "@/lib/storage/service";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TEnvironment } from "@formbricks/types/environment";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { ZProject } from "@formbricks/types/project";
import { createProject, deleteProject, updateProject } from "./project";

const baseProject = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Project 1",
  organizationId: "org1",
  languages: [],
  recontactDays: 0,
  linkSurveyBranding: false,
  inAppSurveyBranding: false,
  config: { channel: null, industry: null },
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
  environments: [
    {
      id: "prodenv",
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "production" as TEnvironment["type"],
      projectId: "p1",
      appSetupCompleted: false,
    },
    {
      id: "devenv",
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "development" as TEnvironment["type"],
      projectId: "p1",
      appSetupCompleted: false,
    },
  ],
  styling: { allowStyleOverwrite: true },
  logo: null,
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    projectTeam: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("@/lib/project/cache", () => ({
  projectCache: {
    revalidate: vi.fn(),
  },
}));
vi.mock("@/lib/environment/cache", () => ({
  environmentCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/storage/service", () => ({
  deleteLocalFilesByEnvironmentId: vi.fn(),
  deleteS3FilesByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/environment/service", () => ({
  createEnvironment: vi.fn(),
}));

let mockIsS3Configured = true;
vi.mock("@/lib/constants", () => ({
  isS3Configured: () => {
    return mockIsS3Configured;
  },
}));

describe("project lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProject", () => {
    test("updates project and revalidates cache", async () => {
      vi.mocked(prisma.project.update).mockResolvedValueOnce(baseProject as any);
      vi.mocked(projectCache.revalidate).mockImplementation(() => {});
      const result = await updateProject("p1", { name: "Project 1", environments: baseProject.environments });
      expect(result).toEqual(ZProject.parse(baseProject));
      expect(prisma.project.update).toHaveBeenCalled();
      expect(projectCache.revalidate).toHaveBeenCalledWith({ id: "p1", organizationId: "org1" });
    });

    test("throws DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.project.update).mockRejectedValueOnce(
        new (class extends Error {
          constructor() {
            super();
            this.message = "fail";
          }
        })()
      );
      await expect(updateProject("p1", { name: "Project 1" })).rejects.toThrow();
    });

    test("throws ValidationError on Zod error", async () => {
      vi.mocked(prisma.project.update).mockResolvedValueOnce({ ...baseProject, id: 123 } as any);
      await expect(
        updateProject("p1", { name: "Project 1", environments: baseProject.environments })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("createProject", () => {
    test("creates project, environments, and revalidates cache", async () => {
      vi.mocked(prisma.project.create).mockResolvedValueOnce({ ...baseProject, id: "p2" } as any);
      vi.mocked(prisma.projectTeam.createMany).mockResolvedValueOnce({} as any);
      vi.mocked(createEnvironment).mockResolvedValueOnce(baseProject.environments[0] as any);
      vi.mocked(createEnvironment).mockResolvedValueOnce(baseProject.environments[1] as any);
      vi.mocked(prisma.project.update).mockResolvedValueOnce(baseProject as any);
      vi.mocked(projectCache.revalidate).mockImplementation(() => {});
      const result = await createProject("org1", { name: "Project 1", teamIds: ["t1"] });
      expect(result).toEqual(baseProject);
      expect(prisma.project.create).toHaveBeenCalled();
      expect(prisma.projectTeam.createMany).toHaveBeenCalled();
      expect(createEnvironment).toHaveBeenCalled();
      expect(projectCache.revalidate).toHaveBeenCalledWith({ id: "p2", organizationId: "org1" });
    });

    test("throws ValidationError if name is missing", async () => {
      await expect(createProject("org1", {})).rejects.toThrow(ValidationError);
    });

    test("throws InvalidInputError on unique constraint", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.project.create).mockRejectedValueOnce(prismaError);
      await expect(createProject("org1", { name: "Project 1" })).rejects.toThrow(InvalidInputError);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.project.create).mockRejectedValueOnce(prismaError);
      await expect(createProject("org1", { name: "Project 1" })).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.project.create).mockRejectedValueOnce(new Error("fail"));
      await expect(createProject("org1", { name: "Project 1" })).rejects.toThrow("fail");
    });
  });

  describe("deleteProject", () => {
    test("deletes project, deletes files, and revalidates cache (S3)", async () => {
      vi.mocked(prisma.project.delete).mockResolvedValueOnce(baseProject as any);

      vi.mocked(deleteS3FilesByEnvironmentId).mockResolvedValue(undefined);
      vi.mocked(projectCache.revalidate).mockImplementation(() => {});
      vi.mocked(environmentCache.revalidate).mockImplementation(() => {});
      const result = await deleteProject("p1");
      expect(result).toEqual(baseProject);
      expect(deleteS3FilesByEnvironmentId).toHaveBeenCalledWith("prodenv");
      expect(projectCache.revalidate).toHaveBeenCalledWith({ id: "p1", organizationId: "org1" });
      expect(environmentCache.revalidate).toHaveBeenCalledWith({ projectId: "p1" });
    });

    test("deletes project, deletes files, and revalidates cache (local)", async () => {
      vi.mocked(prisma.project.delete).mockResolvedValueOnce(baseProject as any);
      mockIsS3Configured = false;
      vi.mocked(deleteLocalFilesByEnvironmentId).mockResolvedValue(undefined);
      vi.mocked(projectCache.revalidate).mockImplementation(() => {});
      vi.mocked(environmentCache.revalidate).mockImplementation(() => {});
      const result = await deleteProject("p1");
      expect(result).toEqual(baseProject);
      expect(deleteLocalFilesByEnvironmentId).toHaveBeenCalledWith("prodenv");
      expect(projectCache.revalidate).toHaveBeenCalledWith({ id: "p1", organizationId: "org1" });
      expect(environmentCache.revalidate).toHaveBeenCalledWith({ projectId: "p1" });
    });

    test("logs error if file deletion fails", async () => {
      vi.mocked(prisma.project.delete).mockResolvedValueOnce(baseProject as any);
      mockIsS3Configured = true;
      vi.mocked(deleteS3FilesByEnvironmentId).mockRejectedValueOnce(new Error("fail"));
      vi.mocked(logger.error).mockImplementation(() => {});
      vi.mocked(projectCache.revalidate).mockImplementation(() => {});
      vi.mocked(environmentCache.revalidate).mockImplementation(() => {});
      await deleteProject("p1");
      expect(logger.error).toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.project.delete).mockRejectedValueOnce(err as any);
      await expect(deleteProject("p1")).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.project.delete).mockRejectedValueOnce(new Error("fail"));
      await expect(deleteProject("p1")).rejects.toThrow("fail");
    });
  });
});
