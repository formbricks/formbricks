import { FormOrder, Location, Formation, Province } from "@prisma/client";

export const SourcingAnsweringOrderOptions = Object.values(FormOrder);

export const SourcingLocations = Object.values(Location);

export const SourcingFormations = Object.values(Formation);

let prov= Province;
Object.keys(Province).forEach(p=>{
  prov[p]=Province[p].replace('_', '-').replace(/Kasai/, 'Kasaï');
});
export const DRCProvinces=prov;
