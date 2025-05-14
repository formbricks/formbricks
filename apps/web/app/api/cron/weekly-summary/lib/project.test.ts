import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getProjectsByOrganizationId } from "./project";

const mockProjects = [
  {
    id: "project1",
    name: "Project 1",
    environments: [
      {
        id: "env1",
        type: "production",
        surveys: [],
        attributeKeys: [],
      },
    ],
    organization: {
      memberships: [
        {
          user: {
            id: "user1",
            email: "test@example.com",
            notificationSettings: {
              weeklySummary: {
                project1: true,
              },
            },
            locale: "en",
          },
        },
      ],
    },
  },
];

const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Set to 6 days ago to be within the last 7 days

const mockProjectsWithNoEnvironments = [
  {
    id: "project3",
    name: "Project 3",
    environments: [],
    organization: {
      memberships: [
        {
          user: {
            id: "user1",
            email: "test@example.com",
            notificationSettings: {
              weeklySummary: {
                project3: true,
              },
            },
            locale: "en",
          },
        },
      ],
    },
  },
];

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

describe("Project Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("getProjectsByOrganizationId", () => {
    test("retrieves projects with environments, surveys, and organization memberships for a valid organization ID", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);

      const organizationId = "testOrgId";
      const projects = await getProjectsByOrganizationId(organizationId);

      expect(projects).toEqual(mockProjects);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: organizationId,
        },
        select: {
          id: true,
          name: true,
          environments: {
            where: {
              type: "production",
            },
            select: {
              id: true,
              surveys: {
                where: {
                  NOT: {
                    AND: [
                      { status: "completed" },
                      {
                        responses: {
                          none: {
                            createdAt: {
                              gte: expect.any(Date),
                            },
                          },
                        },
                      },
                    ],
                  },
                  status: {
                    not: "draft",
                  },
                },
                select: {
                  id: true,
                  name: true,
                  questions: true,
                  status: true,
                  responses: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                      createdAt: true,
                      updatedAt: true,
                      finished: true,
                      data: true,
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                  displays: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  hiddenFields: true,
                },
              },
              attributeKeys: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  name: true,
                  description: true,
                  type: true,
                  environmentId: true,
                  key: true,
                  isUnique: true,
                },
              },
            },
          },
          organization: {
            select: {
              memberships: {
                select: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      notificationSettings: true,
                      locale: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    test("handles date calculations correctly across DST boundaries", async () => {
      const mockDate = new Date(2024, 10, 3, 0, 0, 0); // November 3, 2024, 00:00:00 (example DST boundary)
      const sevenDaysAgo = new Date(mockDate);
      sevenDaysAgo.setDate(mockDate.getDate() - 7);

      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);

      const organizationId = "testOrgId";
      await getProjectsByOrganizationId(organizationId);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: organizationId,
          },
          select: expect.objectContaining({
            environments: expect.objectContaining({
              select: expect.objectContaining({
                surveys: expect.objectContaining({
                  where: expect.objectContaining({
                    NOT: expect.objectContaining({
                      AND: expect.arrayContaining([
                        expect.objectContaining({ status: "completed" }),
                        expect.objectContaining({
                          responses: expect.objectContaining({
                            none: expect.objectContaining({
                              createdAt: expect.objectContaining({
                                gte: sevenDaysAgo,
                              }),
                            }),
                          }),
                        }),
                      ]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
      );

      vi.useRealTimers();
    });

    test("includes surveys with 'completed' status but responses within the last 7 days", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);

      const organizationId = "testOrgId";
      const projects = await getProjectsByOrganizationId(organizationId);

      expect(projects).toEqual(mockProjects);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: organizationId,
        },
        select: {
          id: true,
          name: true,
          environments: {
            where: {
              type: "production",
            },
            select: {
              id: true,
              surveys: {
                where: {
                  NOT: {
                    AND: [
                      { status: "completed" },
                      {
                        responses: {
                          none: {
                            createdAt: {
                              gte: expect.any(Date),
                            },
                          },
                        },
                      },
                    ],
                  },
                  status: {
                    not: "draft",
                  },
                },
                select: {
                  id: true,
                  name: true,
                  questions: true,
                  status: true,
                  responses: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                      createdAt: true,
                      updatedAt: true,
                      finished: true,
                      data: true,
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                  displays: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  hiddenFields: true,
                },
              },
              attributeKeys: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  name: true,
                  description: true,
                  type: true,
                  environmentId: true,
                  key: true,
                  isUnique: true,
                },
              },
            },
          },
          organization: {
            select: {
              memberships: {
                select: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      notificationSettings: true,
                      locale: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    test("returns an empty array when an invalid organization ID is provided", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce([]);

      const invalidOrganizationId = "invalidOrgId";
      const projects = await getProjectsByOrganizationId(invalidOrganizationId);

      expect(projects).toEqual([]);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: invalidOrganizationId,
        },
        select: {
          id: true,
          name: true,
          environments: {
            where: {
              type: "production",
            },
            select: {
              id: true,
              surveys: {
                where: {
                  NOT: {
                    AND: [
                      { status: "completed" },
                      {
                        responses: {
                          none: {
                            createdAt: {
                              gte: expect.any(Date),
                            },
                          },
                        },
                      },
                    ],
                  },
                  status: {
                    not: "draft",
                  },
                },
                select: {
                  id: true,
                  name: true,
                  questions: true,
                  status: true,
                  responses: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                      createdAt: true,
                      updatedAt: true,
                      finished: true,
                      data: true,
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                  displays: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  hiddenFields: true,
                },
              },
              attributeKeys: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  name: true,
                  description: true,
                  type: true,
                  environmentId: true,
                  key: true,
                  isUnique: true,
                },
              },
            },
          },
          organization: {
            select: {
              memberships: {
                select: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      notificationSettings: true,
                      locale: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    test("handles projects with no environments", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjectsWithNoEnvironments);

      const organizationId = "testOrgId";
      const projects = await getProjectsByOrganizationId(organizationId);

      expect(projects).toEqual(mockProjectsWithNoEnvironments);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: organizationId,
        },
        select: {
          id: true,
          name: true,
          environments: {
            where: {
              type: "production",
            },
            select: {
              id: true,
              surveys: {
                where: {
                  NOT: {
                    AND: [
                      { status: "completed" },
                      {
                        responses: {
                          none: {
                            createdAt: {
                              gte: expect.any(Date),
                            },
                          },
                        },
                      },
                    ],
                  },
                  status: {
                    not: "draft",
                  },
                },
                select: {
                  id: true,
                  name: true,
                  questions: true,
                  status: true,
                  responses: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                      createdAt: true,
                      updatedAt: true,
                      finished: true,
                      data: true,
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                  displays: {
                    where: {
                      createdAt: {
                        gte: expect.any(Date),
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  hiddenFields: true,
                },
              },
              attributeKeys: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  name: true,
                  description: true,
                  type: true,
                  environmentId: true,
                  key: true,
                  isUnique: true,
                },
              },
            },
          },
          organization: {
            select: {
              memberships: {
                select: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      notificationSettings: true,
                      locale: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  });
});
