# Workspace Custom CSS doesn't reach creatives

A creative gets only its own CSS field, scoped to `.fb-creative-button` / `.fb-creative-banner` and behind the same plan gate as survey CSS (ENG-3865, ENG-3580). Workspace Custom CSS is written for the survey card, and reversing this later would restyle every existing creative.

## Consequences

- Since Creatives became self-hosted only (ENG-6602), that plan gate always allows a creative's CSS: it only ever refuses on Formbricks Cloud.
