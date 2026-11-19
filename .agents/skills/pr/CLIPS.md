# Clips

Read when the change is a scroll, an animation, a drag or a transition. Everything else is a still: a
clip of a static screen wastes the reviewer's click.

## What GitHub renders from `raw.githubusercontent.com`

| Asset | In a PR body |
| --- | --- |
| `.png`, `.gif` | `![](raw…)` renders inline; a GIF autoplays and loops |
| `.webm` | Served as `audio/webm`: no picture |
| `.mp4` | Served as `application/octet-stream`: never plays inline |

So the deliverable is two files: the **GIF embedded**, so the reviewer sees the motion without clicking,
and the **MP4 linked** (`https://github.com/<owner>/<repo>/blob/$SHA/.pr-assets/<file>.mp4`) for full
frame rate. Both go through the same add/remove commit pair as the stills.

## Record

Check `command -v ffmpeg` first; without it, see the last section. Playwright records VP8 WebM, finalised
only when the page closes:

```ts
test.use({
  viewport: { width: 1280, height: 820 },
  video: { mode: "on", size: { width: 1280, height: 820 } },
});

test("capture clip", async ({ page, users }) => {
  const user = await users.create();
  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/surveys`);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400); // the one place a timer is right: the transition finishes on camera
  const video = page.video();
  await page.close(); // saveAs waits for the file
  await video?.saveAs("/tmp/shots/filters.webm");
});
```

Video ignores `deviceScaleFactor`, and the cursor is not drawn, so let hover and focus states carry the
interaction. Keep it under ten seconds, starting on the state that matters.

## Convert

```bash
ffmpeg -y -i /tmp/shots/filters.webm -vf "scale=1280:-2" -c:v libx264 -pix_fmt yuv420p \
  -crf 26 -preset veryfast -movflags +faststart -an /tmp/shots/filters.mp4
ffmpeg -y -i /tmp/shots/filters.webm -vf "fps=12,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/shots/palette.png
ffmpeg -y -i /tmp/shots/filters.webm -i /tmp/shots/palette.png \
  -lavfi "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  /tmp/shots/filters.gif
```

## Without ffmpeg

There is no inline motion, so deliver a **filmstrip**: three to five labelled stills at the moments that
matter, in one table row. Take them with `page.screenshot()` at each step; that needs no decoding and
lets you choose the frames. Install a real ffmpeg if the sandbox allows; a filmstrip is the fallback.
