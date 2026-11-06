# PR #9956 focus verification

Screenshots from the real survey renderer built at 3424ed5d01746241e4bfcee36148f1f40c7711df, using a synthetic preview survey in Chromium. No customer data.

Draw a signature, Next, Back, Next, Back, Clear, ArrowRight. Delayed animation frames expose pending-focus races. Type retains focus after the transition; Tab then focuses the name input.

- type-tab.png: Type tab keeps the keyboard focus ring.
- name-input.png: the next Tab reaches the name input.

The delayed-frame browser reproduction passed 20/20 iterations. The existing signature, keyboard and CSP E2E tests also passed without retries in run 42244443552.
