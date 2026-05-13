import "@prisma/client";

declare module "@prisma/client" {
  namespace Prisma {
    // Prisma exposes this error class at runtime, but the generated client types do not declare it on Prisma.
    const PrismaClientKnownRequestError: typeof import("@prisma/client/runtime/library").PrismaClientKnownRequestError;
  }
}
