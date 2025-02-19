import { responsePaths } from "@/modules/api/management/responses/lib/openapi";
import * as yaml from "yaml";
import { z } from "zod";
import { createDocument, extendZodWithOpenApi } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";

extendZodWithOpenApi(z);

const document = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Formbricks API",
    description: "Manage Formbricks ressources programmatically.",
    version: "2.0.0",
  },
  paths: {
    ...responsePaths,
  },
  servers: [
    {
      url: "https://app.formbricks.com/api",
      description: "Formbricks Cloud",
    },
  ],
  tags: [
    {
      name: "responses",
      description: "Operations for managing responses.",
    },
  ],
  components: {
    schemas: {
      response: ZResponse,
    },
  },
});

console.log(yaml.stringify(document));
