import { prisma } from "@formbricks/database";

export const getEventClasses = async (environmentId: string) => {

    const eventClasses = await prisma.eventClass.findMany({
        where: {
          environment: {
            id: environmentId,
          },
        },
        include: {
          _count: {
            select: {
              events: true,
            },
          },
        },
      });

    if (!eventClasses) {
        return null
    }


    return eventClasses
}

export const getEventClass = async (eventClassId: string) => {

    const eventClass = await prisma.eventClass.findFirst({
        where: {
            id: eventClassId,
        },
    });

    if (!eventClass) {
        return null
    }

    const numEventsLastHour = await prisma.event.count({
        where: {
            eventClassId,
            createdAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000),
            },
        },
    });
    const numEventsLast24Hours = await prisma.event.count({
        where: {
            eventClassId,
            createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
        },
    });
    const numEventsLast7Days = await prisma.event.count({
        where: {
            eventClassId,
            createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
        },
    });
    const activeSurveysData = await prisma.surveyTrigger.findMany({
        where: {
            eventClassId,
            survey: {
                status: "inProgress",
            },
        },
        select: {
            survey: {
                select: {
                    name: true,
                },
            },
        },
    });
    const activeSurveys = activeSurveysData.map((t) => t.survey.name);

    const inactiveSurveysData = await prisma.surveyTrigger.findMany({
        where: {
            eventClassId,
            survey: {
                status: {
                    in: ["paused", "completed"],
                },
            },
        },
        select: {
            survey: {
                select: {
                    name: true,
                },
            },
        },
    });
    const inactiveSurveys = inactiveSurveysData.map((t) => t.survey.name);

    return ({
        ...eventClass,
        numEventsLastHour,
        numEventsLast24Hours,
        numEventsLast7Days,
        activeSurveys,
        inactiveSurveys,
    });
};

export const updateEventClass = async (eventClassId: string, data: any) => {

    const currentEventClass = await prisma.eventClass.findUnique({
        where: {
            id: eventClassId,
        },
    });

    if (!currentEventClass) {
        throw new Error("Event class not found");
    }

    if (currentEventClass.type === "automatic") {
        throw new Error("Automatic event classes cannot be updated");
    }

    const updatedEventClass = await prisma.eventClass.update({
        where: {
            id: eventClassId,
        },
        data: {
            ...data,
        },
    });

    return updatedEventClass;
};


export const deleteEventClass = async (eventClassId: string) => {

    await prisma.eventClass.delete({
        where: {
            id: eventClassId,
        },
    });

};