# A Signature answer is a single URL string, not an array like File upload

A Signature element stores `response.data[elementId]` as one storage URL string (ENG-6810), while File upload always stores an array of URLs. Every API that returns `data` (v1, v2, v3 detail, webhooks) publishes the stored shape, and "one signature is one URL" is the cleaner contract for API users; reusing File upload's array would have been less code but would have shipped a one-item array we could never take back.

## Consequences

File upload's delete, write-validation, attachments and display code skips non-arrays on purpose: it stops a text answer holding a pasted storage URL from becoming a delete target, and a planted foreign URL from being validated as an upload. Signature therefore opts in by element id, not by shape: `collectResponseFileUrls`, `validateClientFileUploads`, `validateSurveyAllowsUpload` and the attachments export accept a string only for Signature element ids. `uploadElementKinds` (`modules/storage/survey-upload-elements.ts`) records where the two upload element types differ, and those sites read it. Never loosen the array check for every element.

A Signature answer outlives its element: deleting the element, or retyping it, leaves the string under an id the survey no longer has. So a bare string under an id that is not a live element is also a delete candidate, still bound by its key to this survey and to that id, while a bare string under a live non-Signature element stays skipped. An array under a Signature id is read too, so a File upload retyped to Signature still has its files collected.
