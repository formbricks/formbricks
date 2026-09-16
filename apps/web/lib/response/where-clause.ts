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
 * PostgreSQL's 65535 ceiling.
 *
 * What that buys is not one number. The multi branch charges `positions x (distinct labels + 1)`, and
 * a label exists per language, so the reachable choice count falls roughly as `10000 / (L x c)`: ~99
 * choices monolingual, but only ~40 trilingual, and a 45-option country list in five languages does
 * not fit. Deduplicating labels below recovers the common case where a choice is left untranslated
 * and the same text repeats across languages, but not one that is genuinely translated five ways.
 * Sharing the budget across keys means `tags` or a second `data` key takes from the same allowance.
 *
 * A filter past the budget throws, which the analysis actions surface as a hard error. That is the
 * deliberate trade against ENG-3161's unbounded predicate, but it is reachable by a legitimate survey
 * rather than only by an abusive one — see the PR's open gaps.
 */
const MAX_FILTER_CLAUSES = 10_000;

/**
 * Extra array positions probed beyond the element's choice count when testing for an "Other" write-in.
 *
 * Sized for the two ways a stored answer outgrows `choices.length` in practice — a handful of repeated
 * entries, or a few choices deleted from a running survey after the answer was collected. It is a
 * mitigation, not a proof: see the probe itself for what remains uncovered.
 */
const OTHER_WRITE_IN_PROBE_SLACK = 8;

/**
 * One call's clause allowance. The returned `spend` charges against it and refuses the filter once
 * it is exhausted. Kept out of buildWhereClause so the budget is a self-contained concern rather
 * than more branching inside an already-large builder.
 */
const createClauseBudget = (): ((count: number) => void) => {
  let remaining = MAX_FILTER_CLAUSES;

  return (count: number): void => {
    remaining -= count;
    if (remaining < 0) {
      throw new InvalidInputError("This response filter is too large to evaluate");
    }
  };
};

export const buildWhereClause = (survey: TSurvey, filterCriteria?: TResponseFilterCriteria) => {
  const whereClause: Prisma.ResponseWhereInput["AND"] = [];

  const spend = createClauseBudget();

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
    // `applied` expands to one relation subquery per tag, so charge what was actually emitted.
    const tagFilters = createFilterTags(filterCriteria.tags);
    spend(tagFilters.length);

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
            // Deduplicated: a choice left untranslated carries the same text under every language
            // key, and `{ not: label }` twice is the same clause twice. Charging it once per language
            // spent the budget on nothing (ENG-3161 review).
            const predefinedLabelSet = new Set<string>();

            element.choices.forEach((choice) => {
              Object.values(choice.label).forEach((label) => {
                if (!values.has(label)) {
                  predefinedLabelSet.add(label);
                }
              });
            });

            const predefinedLabels = [...predefinedLabelSet];

            if (element.type === "multipleChoiceMulti") {
              // A multi answer is a string[] of the chosen labels, with the "Other" write-in stored
              // as the raw typed text. "Other was chosen" therefore means: at least one entry is
              // not a predefined label. Prisma's JSON filters have no subset operator, so each
              // array position is probed by numeric path segment; positions past the end extract to
              // SQL NULL, so unanswered and empty ([]) responses correctly do not match.
              //
              // A well-formed answer holds at most one entry per choice, so `choices.length` would
              // cover it. Stored answers are not guaranteed well-formed, and both ways past that end
              // with the write-in at an unprobed index — silently narrowing what the pre-ENG-3161
              // predicate matched:
              //
              //   - nothing enforces uniqueness (`ZResponseDataValue` is `z.array(z.string())` with
              //     no cap), so `["A0","A0","A0","A0","write-in"]` is accepted on a 3-choice element;
              //   - deleting choices from a running survey shrinks `choices.length` while the already
              //     collected answers keep their original length.
              //
              // The slack covers both at realistic sizes. It cannot close the class — an array with
              // more than SLACK duplicates still escapes — because a positional probe cannot bound an
              // unbounded array. Bounding the stored array on write is the real fix and its own ticket.
              const positions = element.choices.length + OTHER_WRITE_IN_PROBE_SLACK;
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
