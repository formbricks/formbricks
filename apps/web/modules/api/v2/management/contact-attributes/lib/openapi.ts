import { createContactAttributeEndpoint, getContactAttributesEndpoint } from "@/modules/api/v2/lib/openapi";
import {
  deleteContactAttributeEndpoint,
  getContactAttributeEndpoint,
  updateContactAttributeEndpoint,
} from "@/modules/api/v2/management/contact-attributes/[contactAttributeId]/lib/openapi";
import { ZodOpenApiPathsObject } from "zod-openapi";

export const contactAttributePaths: ZodOpenApiPathsObject = {
  "/contact-attributes": {
    get: getContactAttributesEndpoint,
    post: createContactAttributeEndpoint,
  },
  "/contact-attributes/{id}": {
    get: getContactAttributeEndpoint,
    put: updateContactAttributeEndpoint,
    delete: deleteContactAttributeEndpoint,
  },
};
