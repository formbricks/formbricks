import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import {
  TDocument,
  TDocumentCreateInput,
  ZDocumentCreateInput,
  ZDocumentType,
} from "@formbricks/types/documents";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";
import { documentCache } from "./cache";

export type TPrismaDocument = Omit<TDocument, "vector"> & {
  vector: string;
};

export const createDocument = async (documentInput: TDocumentCreateInput): Promise<TDocument> => {
  validateInputs([documentInput, ZDocumentCreateInput]);

  try {
    const { vector, ...data } = documentInput;

    const prismaDocument = await prisma.document.create({
      data,
    });

    const document = {
      ...prismaDocument,
      vector,
    };

    // update vector
    const vectorString = `[${vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Document"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${document.id};
    `;

    documentCache.revalidate({
      id: document.id,
      type: document.type,
      referenceId: document.referenceId,
    });

    return document;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDocumentsByTypeAndReferenceId = reactCache(
  (type: string, referenceId: string): Promise<TDocument[]> =>
    cache(
      async () => {
        validateInputs([type, ZDocumentType], [referenceId, ZString]);

        try {
          const prismaDocuments: TPrismaDocument[] = await prisma.$queryRaw`
            SELECT
              id,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              type,
              text,
              "referenceId",
              vector::text
            FROM "Document" e
            WHERE e."type" = ${type}::"DocumentType"
              AND e."referenceId" = ${referenceId}
          `;

          const documents = prismaDocuments.map((prismaDocument) => {
            // Convert the string representation of the vector back to an array of numbers
            const vector = prismaDocument.vector
              .slice(1, -1) // Remove the surrounding square brackets
              .split(",") // Split the string into an array of strings
              .map(Number); // Convert each string to a number
            return {
              ...prismaDocument,
              vector,
            };
          });

          return documents;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getDocumentsByTypeAndReferenceId-${type}-${referenceId}`],
      {
        tags: [documentCache.tag.byTypeAndReferenceId(type, referenceId)],
      }
    )()
);
