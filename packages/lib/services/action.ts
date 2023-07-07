import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { EventType } from "@prisma/client";

export type TranformEventClassOutput = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  type: EventType;
  noCodeConfig: any;
  environmentId: string;
  eventCount: number;
};

export const transformPrismaEventClass = (eventClass): TranformEventClassOutput | null => {
  if (eventClass === null) {
    return null;
  }

  const transformedEventClass: TranformEventClassOutput = {
    id: eventClass.id,
    name: eventClass.name,
    description: eventClass.description,
    type: eventClass.type,
    noCodeConfig: eventClass.noCodeConfig,
    environmentId: eventClass.environmentId,
    eventCount: eventClass._count.events,
    createdAt: eventClass.createdAt,
    updatedAt: eventClass.updatedAt,
  };

  return transformedEventClass;
};

export const getActionClasses = async (environmentId: string): Promise<TranformEventClassOutput[]> => {
  try {
    let eventClasses = await prisma.eventClass.findMany({
      where: {
        environmentId: environmentId,
      },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
    });
    eventClasses.sort((first, second) => {
      return first.createdAt.getTime() - second.createdAt.getTime();
    });

    const transformedEventClasses: TranformEventClassOutput[] = eventClasses
      .map(transformPrismaEventClass)
      .filter(
        (eventClass: TranformEventClassOutput | null): eventClass is TranformEventClassOutput =>
          eventClass !== null
      );

    return transformedEventClasses;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
  }
};
