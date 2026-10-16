import { Prisma } from "@formbricks/database/prisma";

type TPagedRow = { id: string; createdAt: Date };

type TFindManyArgs = {
  where?: Prisma.ResponseWhereInput;
  skip?: number;
  take?: number;
  cursor?: unknown;
};

const toComparable = (value: string | Date) => (value instanceof Date ? value.getTime() : value);

const compareDesc = (a: string | number, b: string | number) => {
  if (a === b) return 0;
  return a < b ? 1 : -1;
};

const matchesCondition = (value: string | Date, condition: unknown): boolean => {
  if (typeof condition === "string" || condition instanceof Date) {
    return toComparable(value) === toComparable(condition);
  }

  return Object.entries(condition as Record<string, string | Date>).every(([operator, bound]) => {
    if (operator === "lt") return toComparable(value) < toComparable(bound);
    if (operator === "lte") return toComparable(value) <= toComparable(bound);
    throw new Error(`In-memory findMany does not support the "${operator}" operator`);
  });
};

const matchesWhere = (row: TPagedRow, where: Prisma.ResponseWhereInput): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (condition as Prisma.ResponseWhereInput[]).every((w) => matchesWhere(row, w));
    if (key === "OR") return (condition as Prisma.ResponseWhereInput[]).some((w) => matchesWhere(row, w));
    // Every row belongs to the survey under test.
    if (key === "surveyId") return true;
    if (key === "id" || key === "createdAt") return matchesCondition(row[key], condition);
    throw new Error(`In-memory findMany does not support the "${key}" where key`);
  });

/**
 * In-memory stand-in for `prisma.response.findMany` over `rows`, for tests that page through every
 * response of a survey. It evaluates the part of `where` the batch loops use (`AND`, `OR`, and `id` or
 * `createdAt` by equality, `lt` or `lte`), sorts by `createdAt desc, id desc` and applies `skip` and
 * `take`. Anything else throws, so a query it cannot evaluate fails the test instead of passing.
 *
 * `rows` is read on every call, so a test can delete one between batches.
 */
export const createInMemoryResponseFindMany =
  <T extends TPagedRow>(rows: T[]) =>
  async ({ where = {}, skip = 0, take, cursor }: TFindManyArgs): Promise<T[]> => {
    if (cursor !== undefined) throw new Error("In-memory findMany does not support Prisma's cursor option");

    const ordered = rows
      .filter((row) => matchesWhere(row, where))
      .sort((a, b) => compareDesc(a.createdAt.getTime(), b.createdAt.getTime()) || compareDesc(a.id, b.id));

    return ordered.slice(skip, take === undefined ? undefined : skip + take);
  };
