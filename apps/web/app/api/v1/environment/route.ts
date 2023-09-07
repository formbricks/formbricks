import { responses } from "@/lib/api/response";
import { populateEnvironment } from "@/lib/populate";
import { prisma } from "@formbricks/database";
import { EnvironmentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthentication } from "@/app/api/v1/auth";

export async function GET(request: Request): Promise<NextResponse> {
    // Check Authentication
    const authentication = await getAuthentication(request)
    if (!authentication) {
        return responses.notAuthenticatedResponse();
    }
    if (authentication.type !== "session") {
        return responses.badRequestResponse("invalid authentication object")
    }
    const user = authentication.session.user

    // find first production enviroment of the user
    const firstMembership = await prisma.membership.findFirst({
        where: {
            userId: user.id,
        },
        select: {
            teamId: true,
        },
    });

    if (!firstMembership) {
        // create a new team and return environment
        const membership = await prisma.membership.create({
            data: {
                accepted: true,
                role: "owner",
                user: { connect: { id: user.id } },
                team: {
                    create: {
                        name: `${user.name}'s Team`,
                        products: {
                            create: {
                                name: "My Product",
                                environments: {
                                    create: [
                                        {
                                            type: EnvironmentType.production,
                                            ...populateEnvironment,
                                        },
                                        {
                                            type: EnvironmentType.development,
                                            ...populateEnvironment,
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            include: {
                team: {
                    include: {
                        products: {
                            include: {
                                environments: true,
                            },
                        },
                    },
                },
            },
        });

        const environment = membership.team.products[0].environments[0];

        return responses.successResponse(environment);
        // return res.status(404).json({ message: "No memberships found" });
    }

    const firstProduct = await prisma.product.findFirst({
        where: {
            teamId: firstMembership.teamId,
        },
        select: {
            id: true,
        },
    });
    if (firstProduct === null) {
        return responses.notFoundResponse("product",firstMembership.teamId)
    }
    const firstEnvironment = await prisma.environment.findFirst({
        where: {
            productId: firstProduct.id,
            type: "production",
        },
        select: {
            id: true,
        },
    });
    if (firstEnvironment === null) {
        return responses.notFoundResponse("environment",firstProduct.id)
    }
    return responses.successResponse(firstEnvironment);

}
