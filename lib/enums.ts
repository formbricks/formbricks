import { FormOrder, Location, Formation } from "@prisma/client";

export const SourcingAnsweringOrderOptions = [
  FormOrder.RANDOM,
  FormOrder.SEQUENTIAL,
  FormOrder.ABTEST,
];

export const SourcingLocations = [
  Location.Kinshasa,
  Location.Goma,
  Location.Lubumbashi,
  Location.Autre,
];
export const SourcingFormations = [
  Formation.DEV,
  Formation.SMD,
  Formation.AUTRE,
];
