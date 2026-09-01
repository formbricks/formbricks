import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import {
  getComputedEmbeddedFields,
  getSurveyEmbeddedFields,
  listShadowingNames,
} from "@formbricks/types/embedded-data-resolver";
import { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { generateAllPermutationsOfSubsets } from "./utils";

type TTypedFieldFilterCondition = NonNullable<TResponseFilterCriteria["reserved"]>[string];

type TReservedFilterLocator = { kind: "meta"; path: string[] } | { kind: "ttcTotalMs" };

/**
 * Where each filterable reserved field physically lives on the Response row. The catalog carries
 * typed `read` accessors instead of path strings on purpose (see the rationale in
 * embedded-data-resolver.ts), so the DB layer owns this map; the anti-drift test in utils.test.ts
 * pins that every entry `getReservedFilterEntries` can offer has a locator. `durationSeconds` is
 * the one computed entry — it filters the stored `ttc._total` milliseconds through windows that
 * reproduce the read seam's `Math.round(ms / 1000)` projection exactly.
 */
export const RESERVED_FILTER_LOCATORS: Record<string, TReservedFilterLocator> = {
  source: { kind: "meta", path: ["source"] },
  url: { kind: "meta", path: ["url"] },
  country: { kind: "meta", path: ["country"] },
  action: { kind: "meta", path: ["action"] },
  browser: { kind: "meta", path: ["userAgent", "browser"] },
  os: { kind: "meta", path: ["userAgent", "os"] },
  deviceType: { kind: "meta", path: ["userAgent", "device"] },
  ipAddress: { kind: "meta", path: ["ipAddress"] },
  pagePath: { kind: "meta", path: ["pagePath"] },
  pageReferrer: { kind: "meta", path: ["pageReferrer"] },
  utmSource: { kind: "meta", path: ["utmSource"] },
  utmMedium: { kind: "meta", path: ["utmMedium"] },
  utmCampaign: { kind: "meta", path: ["utmCampaign"] },
  utmTerm: { kind: "meta", path: ["utmTerm"] },
  utmContent: { kind: "meta", path: ["utmContent"] },
  screenWidth: { kind: "meta", path: ["screenWidth"] },
  screenHeight: { kind: "meta", path: ["screenHeight"] },
  viewportWidth: { kind: "meta", path: ["viewportWidth"] },
  viewportHeight: { kind: "meta", path: ["viewportHeight"] },
  timezone: { kind: "meta", path: ["timezone"] },
  locale: { kind: "meta", path: ["locale"] },
  durationSeconds: { kind: "ttcTotalMs" },
};

const mkJsonColumnFilter = (
  column: "meta" | "variables",
  filter: Prisma.ResponseWhereInput["meta"]
): Prisma.ResponseWhereInput => (column === "meta" ? { meta: filter } : { variables: filter });

/**
 * One typed condition → one Prisma JSON-path filter on `meta` or `variables`. `notEquals` and
 * `isNotSet` treat an absent value as a match (same stance as the `data` branch below); ops that
 * don't fit the column's value (e.g. text ops sent for a number field) emit nothing — fail closed.
 */
const buildJsonPathCondition = (
  column: "meta" | "variables",
  path: string[],
  val: TTypedFieldFilterCondition
): Prisma.ResponseWhereInput | null => {
  switch (val.op) {
    case "equals":
      return mkJsonColumnFilter(column, { path, equals: val.value });
    case "notEquals":
      return {
        OR: [
          mkJsonColumnFilter(column, { path, not: val.value }),
          mkJsonColumnFilter(column, { path, equals: Prisma.DbNull }),
        ],
      };
    case "contains":
      return mkJsonColumnFilter(column, { path, string_contains: val.value });
    case "doesNotContain":
      return { NOT: mkJsonColumnFilter(column, { path, string_contains: val.value }) };
    case "startsWith":
      return mkJsonColumnFilter(column, { path, string_starts_with: val.value });
    case "doesNotStartWith":
      return { NOT: mkJsonColumnFilter(column, { path, string_starts_with: val.value }) };
    case "endsWith":
      return mkJsonColumnFilter(column, { path, string_ends_with: val.value });
    case "doesNotEndWith":
      return { NOT: mkJsonColumnFilter(column, { path, string_ends_with: val.value }) };
    case "lessThan":
      return mkJsonColumnFilter(column, { path, lt: val.value });
    case "lessEqual":
      return mkJsonColumnFilter(column, { path, lte: val.value });
    case "greaterThan":
      return mkJsonColumnFilter(column, { path, gt: val.value });
    case "greaterEqual":
      return mkJsonColumnFilter(column, { path, gte: val.value });
    case "isSet":
      return mkJsonColumnFilter(column, { path, not: Prisma.DbNull });
    case "isNotSet":
      return mkJsonColumnFilter(column, { path, equals: Prisma.DbNull });
    default:
      return null;
  }
};

/**
 * `durationSeconds` filters in seconds against `ttc._total`, which stores milliseconds. The read
 * seam projects `Math.round(ms / 1000)`, so second `s` covers ms in [s*1000-500, s*1000+500) — the
 * windows below make DB filtering agree with the projected value at every boundary. `ttc._total`
 * only exists on finished responses, so partials never match (except via `isNotSet`).
 */
const buildDurationSecondsCondition = (val: TTypedFieldFilterCondition): Prisma.ResponseWhereInput | null => {
  const path = ["_total"];
  if (val.op === "isSet") return { ttc: { path, not: Prisma.DbNull } };
  if (val.op === "isNotSet") return { ttc: { path, equals: Prisma.DbNull } };
  if (!("value" in val)) return null;
  const seconds = Number(val.value);
  if (!Number.isFinite(seconds)) return null;
  const lower = seconds * 1000 - 500;
  const upper = seconds * 1000 + 500;
  switch (val.op) {
    case "equals":
      return { AND: [{ ttc: { path, gte: lower } }, { ttc: { path, lt: upper } }] };
    case "notEquals":
      return {
        OR: [
          { ttc: { path, lt: lower } },
          { ttc: { path, gte: upper } },
          { ttc: { path, equals: Prisma.DbNull } },
        ],
      };
    case "greaterThan":
      return { ttc: { path, gte: upper } };
    case "greaterEqual":
      return { ttc: { path, gte: lower } };
    case "lessThan":
      return { ttc: { path, lt: lower } };
    case "lessEqual":
      return { ttc: { path, lt: upper } };
    default:
      return null;
  }
};

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

  if (filterCriteria?.reserved) {
    // Fail closed (ENG-1848): a name the survey's declared fields or element ids shadow filters the
    // declared value elsewhere, never the reserved read — and an unknown name emits nothing.
    const elementIds = getElementsFromBlocks(survey.blocks).map((element) => element.id);
    const shadowed = new Set(listShadowingNames(getSurveyEmbeddedFields(survey), elementIds));
    const reserved: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.reserved).forEach(([name, val]) => {
      if (shadowed.has(name)) return;
      const locator = RESERVED_FILTER_LOCATORS[name];
      if (!locator) return;
      const condition =
        locator.kind === "ttcTotalMs"
          ? buildDurationSecondsCondition(val)
          : buildJsonPathCondition("meta", locator.path, val);
      if (condition) reserved.push(condition);
    });

    whereClause.push({
      AND: reserved,
    });
  }

  if (filterCriteria?.variables) {
    // Keys are storageKeys of the survey's computed embedded fields; anything else emits nothing.
    const computedKeys = new Set(getComputedEmbeddedFields(survey).map(({ link }) => link.storageKey));
    const variables: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.variables).forEach(([storageKey, val]) => {
      if (!computedKeys.has(storageKey)) return;
      const condition = buildJsonPathCondition("variables", [storageKey], val);
      if (condition) variables.push(condition);
    });

    whereClause.push({
      AND: variables,
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
        // Text ops for string-typed ingested Embedded Data fields (ENG-1848).
        case "contains":
          data.push({
            data: {
              path: [key],
              string_contains: val.value,
            },
          });
          break;
        case "doesNotContain":
          data.push({
            NOT: {
              data: {
                path: [key],
                string_contains: val.value,
              },
            },
          });
          break;
        case "startsWith":
          data.push({
            data: {
              path: [key],
              string_starts_with: val.value,
            },
          });
          break;
        case "doesNotStartWith":
          data.push({
            NOT: {
              data: {
                path: [key],
                string_starts_with: val.value,
              },
            },
          });
          break;
        case "endsWith":
          data.push({
            data: {
              path: [key],
              string_ends_with: val.value,
            },
          });
          break;
        case "doesNotEndWith":
          data.push({
            NOT: {
              data: {
                path: [key],
                string_ends_with: val.value,
              },
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
