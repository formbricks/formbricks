import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/errors";
// import { cache } from "react"; 

export async function createIntegration(environmentId: string, integrationData: any): Promise<any> {
    try {
        console.log(integrationData)
        const result = await prisma.integration.create({
            data: {
                ...integrationData,
                environment: { connect: { id: environmentId } },
            },
        });
        console.log(result)
        return result;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError("Database operation failed");
        }
        throw error;
    }
}

export async function getIntegrations(environmentId: string): Promise<any> {
    try {
        const result = await prisma.integration.findMany({
            where: {
                environmentId
            }
        });
        return result;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError("Database operation failed");
        }
        throw error;
    }
}

export const deleteIntegration = async (integrationId: string): Promise<void> => {
    try {
        await prisma.integration.delete({
            where: {
                id: integrationId,
            },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError("Database operation failed");
        }

        throw error;
    }
};