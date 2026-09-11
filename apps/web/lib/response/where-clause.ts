import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError } from "@formbricks/types/errors";
import { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

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

/**
 * Upper bound on the filter clauses a single buildWhereClause call may emit.
 *
 * The "Other" branches below scale with the element's choice count, which has no maximum
 * (ZSurveyElementChoice is `.min(2)` only), so an unbounded predicate is a denial-of-service
 * vector — a low-privilege request could allocate until the process died (ENG-3161).
 *
 * The budget is per CALL, not per branch: `filterCriteria.data` is a record whose keys are each
 * iterated below, so a per-branch cap would simply be multiplied by the key count.
 *
 * 10k clauses is ~30k bind parameters (each probe binds key + index + label), comfortably under
 * PostgreSQL's 65535 ceiling, and allows ~99 monolingual choices on a single element — far past
 * any real survey.
 */
const MAX_FILTER_CLAUSES = 10_000;

export const buildWhereClause = (survey: TSurvey, filterCriteria?: TResponseFilterCriteria) => {
  const whereClause: Prisma.ResponseWhereInput["AND"] = [];

  let clauseBudget = MAX_FILTER_CLAUSES;

  /** Charge `count` clauses against this call's budget, refusing the filter once it is exhausted. */
  const spend = (count: number): void => {
    clauseBudget -= count;
    if (clauseBudget < 0) {
      throw new InvalidInputError("This response filter is too large to evaluate");
    }
  };

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
    // `applied` expands to one relation subquery per tag; `notApplied` is a single `notIn`.
    spend((filterCriteria.tags.applied?.length ?? 0) + (filterCriteria.tags.notApplied ? 1 : 0));

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
        case "includesOne": {
          const values = new Set(val.value.map((v) => v.toString()));
          const otherChoice =
            element && (element.type === "multipleChoiceMulti" || element.type === "multipleChoiceSingle")
              ? element.choices.find((choice) => choice.id === "other")
              : null;

          if (
            element &&
            (element.type === "multipleChoiceMulti" || element.type === "multipleChoiceSingle") &&
            element.choices.map((choice) => choice.id).includes("other") &&
            otherChoice &&
            values.has(otherChoice.label.default)
          ) {
            const predefinedLabels: string[] = [];

            element.choices.forEach((choice) => {
              Object.values(choice.label).forEach((label) => {
                if (!values.has(label)) {
                  predefinedLabels.push(label);
                }
              });
            });

            if (element.type === "multipleChoiceMulti") {
              // A multi answer is a string[] of the chosen labels, with the "Other" write-in stored
              // as the raw typed text. "Other was chosen" therefore means: at least one entry is
              // not a predefined label. Prisma's JSON filters have no subset operator, so each
              // array position is probed by numeric path segment. An answer holds at most one entry
              // per choice, so choices.length positions cover it; positions past the end extract to
              // SQL NULL, so unanswered and empty ([]) responses correctly do not match.
              const positions = element.choices.length;
              spend(positions * (predefinedLabels.length + 1));

              data.push({
                OR: Array.from({ length: positions }, (_unused, index) => ({
                  AND: [
                    { data: { path: [key, String(index)], not: Prisma.DbNull } },
                    ...predefinedLabels.map((label) => ({
                      data: { path: [key, String(index)], not: label },
                    })),
                  ],
                })),
              });
            } else {
              // A single answer is a scalar string, so "not any predefined label" is directly
              // expressible and stays linear in the label count.
              spend(predefinedLabels.length);

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
            // Two clauses per selected value: the array shape and the scalar shape.
            spend(val.value.length * 2);

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
        }
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
        case "matrix": {
          const rowLabel = Object.keys(val.value)[0];
          data.push({
            data: {
              path: [key, rowLabel],
              equals: val.value[rowLabel],
            },
          });
          break;
        }
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
