# Question codes are lowercase and separate from Question IDs

Every question gets a question code that is distinct from its Question ID. Responses stay keyed by the ID, which therefore can never change, while the code is the public name in exports, webhooks, prefill and start-at links. A code starts with a lowercase letter, then lowercase letters, digits and `_`, with no `__` and no trailing `_`, at most 30 characters (answer codes use the same characters, at most 20). It is not an SPSS reserved word or an export column name, and it is unique against other question codes, Embedded Data names and other questions' IDs. Codes lock at publish because they name columns in analysts' pipelines. We chose the lowercase rule Embedded Data already uses, so there is one validator, over the capitals ENG-4023 (one naming rule for question codes and Embedded Data) allowed: codes end up in SPSS variable names (64-byte limit, case-insensitive), URLs and webhook keys, where Zapier reads `__` as nesting.

## Considered Options

- **Capitals allowed, up to 64 characters** (ENG-4023): keeps NielsenIQ's `ADM01` style, rejected because it needs a second validator and puts capitals into column names built as `<question>_<answer>`.
- **The Question ID is the code, editable before launch**: rejected because existing surveys hold random IDs, and responses are stored under the ID.

## Consequences

- NielsenIQ's `ADM01` becomes `adm01`, and defaults are `q1`, `q2`, so the docs, the UI mock and ENG-3596 (what a question's default variable name is) say `Q<n>` where the build says `q<n>`.
- The limits are short on purpose: derived names such as `<question>_<answer>_text` must fit SPSS's 64 bytes. Because codes lock at publish, a limit can be loosened later but not tightened.
