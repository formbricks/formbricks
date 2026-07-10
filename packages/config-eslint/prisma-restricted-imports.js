/*
 * Shared `no-restricted-imports` config banning direct `@prisma/client` / `.prisma/client` imports.
 * Prisma's value/type surface must be reached through `@formbricks/database/prisma`, and error
 * guards through `@formbricks/database/errors`, so the driver-adapter wiring stays in one place.
 *
 * `@formbricks/database` itself is exempt (it owns the Prisma facade) via an override in its
 * `.eslintrc.cjs`. Note `@prisma/adapter-pg` is intentionally NOT banned — only the client.
 */
module.exports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@prisma/client", "@prisma/client/*", ".prisma/client", ".prisma/client/*"],
          message:
            "Import Prisma from '@formbricks/database/prisma' (client & types) and error guards from '@formbricks/database/errors' instead of '@prisma/client' directly.",
        },
      ],
    },
  ],
};
