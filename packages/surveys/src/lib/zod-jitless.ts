import { z } from "zod";

// Zod 4 builds its fast object parser with `new Function`, and decides whether it may when the first
// object schema is constructed by probing `new Function("")` in a try/catch. The catch keeps parsing
// working, but on a host page without 'unsafe-eval' the browser has already blocked the probe and filed
// a CSP violation — a console error and a report on every site that shows a survey (ENG-3969). Turning
// the JIT off skips the probe; the renderer's payloads are far too small for it to matter.
z.config({ jitless: true });
