# Visual summary

Read when filling **What & why**. Pick the smallest view that makes the key point clear, and place it
next to the sentence it supports. Keep only the calls, files, props, states and boundaries the reviewer
needs; one visual is usual, two is rare.

- **Logic or an algorithm** as pseudocode:

  ```text
  on(save)
    if content is unchanged
      return cached result
    write new content
  ```

- **Runtime control flow** as a call tree:

  ```text
  submitForm
    createSession
      persistPrompt
    navigateToSession
  ```

- **UI structure** as a component tree, with the state and module boundaries that matter:

  ```text
  <SessionPage> (apps/web/modules/…/page.tsx)
    useSessionEvents()
    <SessionToolbar>
      <RunButton> (packages/ui)
  ```

- **A broad refactor** as a shallow file tree:

  ```text
  modules/charts/
  ├── hooks/   # owns dirty state
  └── lib/     # serializes the query
  ```

- **Interaction or data flow** as mermaid (`sequenceDiagram`, `flowchart`).

- **What changes in a shape that already exists** as a `diff` sketch, matched to the topic: a component
  tree, a file tree, a call tree or a state change.

  ```diff
   xlsx string cell
  -  v: "'" + text            // CSV guard, kept as literal text
  +  v: text, t: "s", z: "@"  // typed text cell
  ```

- **The whole block** only when most of it is new, or when omitted context would hide ownership or
  order.

## Credits

Adapted from the `pr` skill in [mattpocock/skills](https://github.com/mattpocock/skills), under the
MIT license in [LICENSE.md](LICENSE.md). Its visual menu comes from Dex Horthy's `show-me` skill in
[humanlayer/humanlayer](https://github.com/humanlayer/humanlayer).
