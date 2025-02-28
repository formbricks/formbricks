import { PrismaClient } from "@prisma/client";

const createSamlDatabase = async (): Promise<void> => {
  const samlDatabaseUrl = process.env.SAML_DATABASE_URL;

  if (!samlDatabaseUrl) {
    return;
  }

  const urlRegex =
    /^(?<protocol>postgresql|postgres):\/\/(?<username>[^:]+):(?<password>[^@]+)@(?<host>[^:/]+):(?<port>\d+)\/(?<database>[^?]+)(?<temp1>\?(?<query>.*))?$/;
  const urlMatch = urlRegex.exec(samlDatabaseUrl);
  const dbName = urlMatch?.groups?.database;

  if (!dbName) {
    return;
  }

  // Create a Prisma client to connect to the default database
  const prisma = new PrismaClient();

  try {
    // Check if the database exists
    const result = await prisma.$queryRaw`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    // If the database exists, the query will return a result
    if (Array.isArray(result) && result.length > 0) {
      return;
    }

    await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);

    console.log(`Database '${dbName}' created successfully.`);
  } catch (error) {
    console.error(`Error creating database '${dbName}':`, error);
    return;
  } finally {
    await prisma.$disconnect();
  }
};

createSamlDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("Error creating SAML database:", error);
  });
