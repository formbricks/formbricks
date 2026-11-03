# Answer codes come from label text at export, and option text locks at publish

Responses store the label text the respondent saw, in their language, not an option ID (picture selection is the one exception), so a stored answer carries no code. The Analysis export finds the option an answer picked by matching that text against the survey's current options (response language first, then any language) and takes the code from the matched option. To keep that match valid, option text in every language and the deletion of options that existed at launch are locked once a survey is published, and the lock is enforced on the server in every write path, not only in the editor. We chose this over storing option IDs in responses because that change touches every consumer of response data and cannot land in time for the first launch of coded exports, while a lock is cheap and fixes every new survey.

## Considered Options

- **Store option IDs in responses** (ENG-4020, keep choice option identity stable across languages, edits and responses): the right long-term answer, and what will make an Unlock step possible; rejected for now because of its reach.
- **Allow renames and let old answers fall out** (today's export writes `other`): rejected because it silently loses data, which is what a market-research customer complained about.
- **Fuzzy matching of renamed labels**: rejected because a renamed option and an Other write-in look identical in storage, so a guess can be wrong without anyone seeing it.

## Consequences

- A typo in option text cannot be fixed after publishing until answers are stored by option ID and an Unlock step exists.
- An answer that matches no option is listed in the Unmapped values file and is never coded as Other, unless the question has an Other option, where it reads as an Other write-in.
- Surveys already live keep the drift they have; a live bilingual dataset showed under 2% of its coded cells unmapped, from edits and deletions made before this rule.
