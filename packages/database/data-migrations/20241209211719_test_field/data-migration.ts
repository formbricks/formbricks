import type { DataMigrationScript } from "../../types/migration-runner";

export const testField: DataMigrationScript[] = [
  {
    type: "schema",
    name: "20241209160139_made_test_field_nullable",
  },
  {
    id: "v2n3pktagsn75000qxpgryyk",
    type: "data",
    name: "testField",
    run: async ({ tx }) => {
      // Your migration script goes here
      console.log("Running testField migration");
      const environmentsWithTestField = await tx.environment.findMany({
        where: {
          test: {
            not: null,
          },
        },
      });

      console.log("Environments with testField:", environmentsWithTestField.length);
    },
  },
  {
    type: "schema",
    name: "20241209160906_removed_test_field",
  },
];
