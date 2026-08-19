# ENG-2473 chart evidence

Images for https://github.com/formbricks/formbricks/pull/8921. Nothing here is imported by the app
— this branch exists only so the PR body can reference the images, and it is never merged.

Each file is the chart's **own SVG output**, pulled from the running app's DOM and rasterised, not a
photo of a screen. Bar geometry, colours, axis ticks and value labels are exactly what the app drew;
axis labels are re-emitted as `<text>` because recharts renders them in a `foreignObject`, which
`rsvg-convert` cannot draw. The before/after pairs were captured from the same dashboard, the same
data and the same viewport — only the diff differs.

| File | Shows |
| --- | --- |
| `nps-before.png` | NPS by survey on `main`: the two surveys that never asked NPS print `0`, beside a survey whose `0.00` is a real score |
| `nps-after.png` | Same chart with the fix: the unasked surveys draw nothing, the genuine `0.00` is untouched |
| `language-before.png` | CSAT by response language on `main`: third bucket has no label |
| `language-after.png` | Same chart with the fix: the bucket reads "Default language" |
