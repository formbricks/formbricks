import "server-only";

// One implementation for every wrapper: the algorithm lives in `app/lib/api/origin-check.ts`, which the
// v1 wrapper and the session routes use too. This module keeps the v3 imports where they were.
export { getCrossOriginRefusal, type TCrossOriginRefusal } from "@/app/lib/api/origin-check";
