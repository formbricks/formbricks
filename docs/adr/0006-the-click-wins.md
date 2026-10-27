# A click opens the survey regardless of the survey's own targeting

When a creative is pressed, its Destination survey opens immediately while it is Active, ignoring everything about whether and when that survey shows: actions, conditions, segment, recontact, cooldown, share of visitors, delay and auto-close (ENG-3579, ENG-3911). The SDK uses a dedicated click path rather than `triggerSurvey`, which would re-roll the percentage and silently drop clicks while another survey is open. A button-opened display still counts as shown for the survey's own popover rules.

## Consequences

- Pressing a creative while its own Destination survey is already open does nothing and is not counted as a Click, so a second press can't stack the survey on itself.
- Pressing it while another survey is open closes that survey (it counts as closed), opens the Destination and counts the Click.
