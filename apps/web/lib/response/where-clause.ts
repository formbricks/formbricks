import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { generateAllPermutationsOfSubsets } from "./utils";

const createFilterTags = (tags: TResponseFilterCriteria["tags"]) => {
  if (!tags) return [];

  const filterTags: Record<string, any>[] = [];

  if (tags?.applied) {
    const appliedTags = tags.applied.map((name) => ({
      tags: {
        some: {
          tag: {
            name,
          },
        },
      },
    }));
    filterTags.push(appliedTags);
  }

  if (tags?.notApplied) {
    const notAppliedTags = {
      tags: {
        every: {
          tag: {
            name: {
              notIn: tags.notApplied,
            },
          },
        },
      },
    };

    filterTags.push(notAppliedTags);
  }

  return filterTags.flat();
};

export const buildWhereClause = (survey: TSurvey, filterCriteria?: TResponseFilterCriteria) => {
  const whereClause: Prisma.ResponseWhereInput["AND"] = [];

  if (filterCriteria?.finished !== undefined) {
    whereClause.push({
      finished: filterCriteria?.finished,
    });
  }

  if (filterCriteria?.createdAt) {
    const createdAt: { lte?: Date; gte?: Date } = {};
    if (filterCriteria?.createdAt?.max) {
      createdAt.lte = filterCriteria?.createdAt?.max;
    }
    if (filterCriteria?.createdAt?.min) {
      createdAt.gte = filterCriteria?.createdAt?.min;
    }

    whereClause.push({
      createdAt,
    });
  }

  if (filterCriteria?.tags) {
    const tagFilters = createFilterTags(filterCriteria.tags);
    whereClause.push({
      AND: tagFilters,
    });
  }

  if (filterCriteria?.contactAttributes) {
    const contactAttributes: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.contactAttributes).forEach(([key, val]) => {
      switch (val.op) {
        case "equals":
          contactAttributes.push({
            contactAttributes: {
              path: [key],
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          contactAttributes.push({
            contactAttributes: {
              path: [key],
              not: val.value,
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: contactAttributes,
    });
  }

  if (filterCriteria?.meta) {
    const meta: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.meta).forEach(([key, val]) => {
      let updatedKey: string[] = [];
      if (["browser", "os", "device"].includes(key)) {
        updatedKey = ["userAgent", key];
      } else {
        updatedKey = [key];
      }

      switch (val.op) {
        case "equals":
          meta.push({
            meta: {
              path: updatedKey,
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          meta.push({
            meta: {
              path: updatedKey,
              not: val.value,
            },
          });
          break;
        case "contains":
          meta.push({
            meta: {
              path: updatedKey,
              string_contains: val.value,
            },
          });
          break;
        case "doesNotContain":
          meta.push({
            NOT: {
              meta: {
                path: updatedKey,
                string_contains: val.value,
              },
            },
          });
          break;
        case "startsWith":
          meta.push({
            meta: {
              path: updatedKey,
              string_starts_with: val.value,
            },
          });
          break;
        case "doesNotStartWith":
          meta.push({
            NOT: {
              meta: {
                path: updatedKey,
                string_starts_with: val.value,
              },
            },
          });
          break;
        case "endsWith":
          meta.push({
            meta: {
              path: updatedKey,
              string_ends_with: val.value,
            },
          });
          break;
        case "doesNotEndWith":
          meta.push({
            NOT: {
              meta: {
                path: updatedKey,
                string_ends_with: val.value,
              },
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: meta,
    });
  }

  if (filterCriteria?.others) {
    const others: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.others).forEach(([key, val]) => {
      switch (val.op) {
        case "equals":
          others.push({
            [key.toLocaleLowerCase()]: val.value,
          });
          break;
        case "notEquals":
          others.push({
            [key.toLocaleLowerCase()]: {
              not: val.value,
            },
          });
          break;
      }
    });
    whereClause.push({
      AND: others,
    });
  }

  if (filterCriteria?.data) {
    const data: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.data).forEach(([key, val]) => {
      const elements = getElementsFromBlocks(survey.blocks);
      const element = elements.find((element) => element.id === key);

      switch (val.op) {
        case "submitted":
          data.push({
            data: {
              path: [key],
              not: Prisma.DbNull,
            },
          });
          break;
        case "filledOut":
          data.push({
            data: {
              path: [key],
              not: [],
            },
          });
          break;
        case "skipped":
          data.push({
            OR: [
              {
                data: {
                  path: [key],
                  equals: Prisma.DbNull,
                },
              },
              {
                data: {
                  path: [key],
                  equals: "",
                },
              },
              {
                data: {
                  path: [key],
                  equals: [],
                },
              },
            ],
          });
          break;
        case "equals":
          data.push({
            data: {
              path: [key],
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          data.push({
            OR: [
              {
                data: {
                  path: [key],
                  not: val.value,
                },
              },
              {
                data: {
                  path: [key],
                  equals: Prisma.DbNull,
                },
              },
            ],
          });
          break;
        case "lessThan":
          data.push({
            data: {
              path: [key],
              lt: val.value,
            },
          });
          break;
        case "lessEqual":
          data.push({
            data: {
              path: [key],
              lte: val.value,
            },
          });
          break;
        case "greaterThan":
          data.push({
            data: {
              path: [key],
              gt: val.value,
            },
          });
          break;
        case "greaterEqual":
          data.push({
            data: {
              path: [key],
              gte: val.value,
            },
          });
          break;
        case "includesAll":
          data.push({
            data: {
              path: [key],
              array_contains: val.value,
            },
          });
          break;
        case "includesOne":
          const values: string[] = val.value.map((v) => v.toString());
          const otherChoice =
            element && (element.type === "multipleChoiceMulti" || element.type === "multipleChoiceSingle")
              ? element.choices.find((choice) => choice.id === "other")
              : null;

          if (
            element &&
            (element.type === "multipleChoiceMulti" || element.type === "multipleChoiceSingle") &&
            element.choices.map((choice) => choice.id).includes("other") &&
            otherChoice &&
            values.includes(otherChoice.label.default)
          ) {
            const predefinedLabels: string[] = [];

            element.choices.forEach((choice) => {
              Object.values(choice.label).forEach((label) => {
                if (!values.includes(label)) {
                  predefinedLabels.push(label);
                }
              });
            });

            const subsets = generateAllPermutationsOfSubsets(predefinedLabels);
            if (element.type === "multipleChoiceMulti") {
              const subsetConditions = subsets.map((subset) => ({
                data: { path: [key], equals: subset },
              }));
              data.push({
                NOT: {
                  OR: subsetConditions,
                },
              });
            } else {
              data.push({
                AND: predefinedLabels.map((label) => ({
                  NOT: {
                    data: {
                      path: [key],
                      equals: label,
                    },
                  },
                })),
              });
            }
          } else {
            data.push({
              OR: val.value.map((value: string | number) => ({
                OR: [
                  {
                    data: {
                      path: [key],
                      array_contains: [value],
                    },
                  },
                  {
                    data: {
                      path: [key],
                      equals: value,
                    },
                  },
                ],
              })),
            });
          }

          break;
        case "uploaded":
          data.push({
            data: {
              path: [key],
              not: "skipped",
            },
          });
          break;
        case "notUploaded":
          data.push({
            OR: [
              {
                data: {
                  path: [key],
                  equals: "skipped",
                },
              },
              {
                data: {
                  path: [key],
                  equals: Prisma.DbNull,
                },
              },
            ],
          });
          break;
        case "clicked":
          data.push({
            data: {
              path: [key],
              equals: "clicked",
            },
          });
          break;
        case "accepted":
          data.push({
            data: {
              path: [key],
              equals: "accepted",
            },
          });
          break;
        case "booked":
          data.push({
            data: {
              path: [key],
              equals: "booked",
            },
          });
          break;
        case "matrix":
          const rowLabel = Object.keys(val.value)[0];
          data.push({
            data: {
              path: [key, rowLabel],
              equals: val.value[rowLabel],
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: data,
    });
  }

  if (filterCriteria?.responseIds) {
    whereClause.push({
      id: { in: filterCriteria.responseIds },
    });
  }

  if (filterCriteria?.quotas) {
    const quotaFilters: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.quotas).forEach(([quotaId, { op }]) => {
      if (op === "screenedOutNotInQuota") {
        quotaFilters.push({
          NOT: {
            quotaLinks: {
              some: {
                quotaId,
              },
            },
          },
        });
      } else {
        quotaFilters.push({
          quotaLinks: {
            some: {
              quotaId,
              status: op,
            },
          },
        });
      }
    });

    if (quotaFilters.length > 0) {
      whereClause.push({
        AND: quotaFilters,
      });
    }
  }

  return { AND: whereClause };
};
