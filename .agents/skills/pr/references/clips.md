# Clips: recording motion, and what GitHub will render

Read this when the change is a scroll, an animation, a drag or a transition — and before publishing
anything that is not a PNG.

## 1. What GitHub actually renders

| Asset | Served from the orphan branch as | In a PR body |
| --- | --- | --- |
| `.png` | `image/png` | `![](raw…)` renders inline |
| `.gif` | `image/gif` | `![](raw…)` renders inline, autoplays, loops |
| `.webm` | `audio/webm` — note the `audio/` | **No picture.** A `<video>` handed an audio type renders nothing useful |
| `.mp4` | `application/octet-stream` + `nosniff` | **Never plays.** `<video src="raw…">` shows nothing |

An inline video *player* exists on GitHub, but only for files uploaded through its own attachment
mechanism — drag-and-drop into the comment box, which mints a `user-attachments/assets/<uuid>` URL. That
path needs a browser session in the web UI; there is no REST or GraphQL endpoint and no `gh` command for
it, so an agent cannot do it. (That route accepts `.mp4`, `.mov` and `.webm`, capped at 100MB on a paid
org plan, and recommends H.264.)

So the working shape is two files: **the GIF, embedded** so the reviewer sees the motion without clicking,
and **the MP4, committed beside it and linked** for full frame rate and colour. If a clip genuinely needs
an inline player at full fidelity, hand the MP4 to the user to drop into the body themselves — a one-drag
job for a human, impossible for you.

## 2. Record

Record for behaviour that only exists over time: scroll and sticky behaviour, enter/exit animations,
drag-and-drop reordering, skeleton → loaded transitions, a multi-step flow whose intermediate states
matter. Everything else is a still — a clip of a static screen wastes the reviewer's click.

Check `command -v ffmpeg` before you plan the deliverable; without one, §4 changes what you record.

Playwright records **VP8 WebM**, never MP4, and the file is only finalised when the page closes:

```ts
test.use({
  viewport: { width: 1280, height: 820 },
  video: { mode: "on", size: { width: 1280, height: 820 } }, // the root config is retain-on-failure
});

test("capture clip", async ({ page, users }) => {
  const user = await users.create();
  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/surveys`);

  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400); // deliberate: let the transition finish on camera

  const video = page.video();
  await page.close(); // required — saveAs waits for the file to be written
  await video?.saveAs("/tmp/shots/filters.webm");
});
```

Two constraints shape what you record:

- **Video ignores `deviceScaleFactor`.** The same context that writes a 2560×1640 screenshot records a
  1280×820 video. Record at the size people will watch; there is no retina clip.
- **The mouse cursor is not drawn.** A recorded click or hover shows only its effect, so the clip has to be
  legible without a pointer — let the UI's own hover and focus states carry it, or the reviewer sees things
  happening for no visible reason.

Keep it under about ten seconds and start on the state that matters; nobody scrubs a PR clip.

## 3. Convert

WebM plays in Chrome and Firefox but not everywhere, so H.264 MP4 is the copy to publish:

```bash
ffmpeg -y -i /tmp/shots/filters.webm -vf "scale=1280:-2" -c:v libx264 -pix_fmt yuv420p \
  -crf 26 -preset veryfast -movflags +faststart -an /tmp/shots/filters.mp4
```

`-pix_fmt yuv420p` and `+faststart` are what make it play in a browser rather than download;
`scale=…:-2` keeps the height even, which yuv420p requires. And the GIF, two-pass so the palette is
per-clip:

```bash
ffmpeg -y -i /tmp/shots/filters.webm -vf "fps=12,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/shots/palette.png
ffmpeg -y -i /tmp/shots/filters.webm -i /tmp/shots/palette.png \
  -lavfi "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  /tmp/shots/filters.gif
```

The GIF costs frames and bytes — 12fps against the WebM's 25, and roughly 19× the MP4's size for the same
2.5 seconds. That is the price of rendering inline.

## 4. Without a system ffmpeg

No ffmpeg means no MP4 and no GIF, and the raw WebM does not embed either — so there is no inline motion
at all. The deliverable becomes a **filmstrip**: three to five labelled stills at the moments that matter,
in one table row, with the `.webm` committed beside them and linked for anyone who wants to watch it.

The simplest way to get that filmstrip is to skip recording entirely and take a `page.screenshot()` at each
step of the flow. Same artifact, no decode, and you choose the exact frames.

If you already have a `.webm` and want frames out of it, Playwright ships its own ffmpeg wherever the
browsers are installed:

```bash
FF=$(ls -1 ~/.cache/ms-playwright/ffmpeg-*/ffmpeg-* ~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-* 2>/dev/null | head -1)
"$FF" -i /tmp/shots/filters.webm -r 2 -vf "scale=960:-1" -f image2 /tmp/shots/filters-%02d.png
"$FF" -ss 1.5 -i /tmp/shots/filters.webm -frames:v 1 -vf "scale=960:-1" /tmp/shots/filters-poster.png
```

That build is `--disable-everything` with just enough switched on to write a WebM: VP8 decode, matroska
demux, PNG encode, `image2` mux, and the `scale`/`crop`/`pad` filters. So stills are all you get — no
`libx264`, no `gif` encoder — and the `fps` filter is not compiled in either, which is why the frame rate
above is `-r 2` rather than `-vf fps=2`.

If the sandbox lets you install a real ffmpeg, do that instead and use §3; a filmstrip is a fallback, not
an equal.
