import { createId } from "@paralleldrive/cuid2";
import {
  type Browser,
  type CDPSession,
  type Locator,
  type Page,
  type TestInfo,
  expect,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import { prisma } from "@formbricks/database";
import { type Prisma } from "@formbricks/database/prisma";
import { type TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

/**
 * **Signature element, end to end (ENG-6810).**
 *
 * The unit suites pin the pad model, the PNG export, the storage rules for a URL-string answer and the
 * v3 shape on their own. This walks the seams none of them reach, against real object storage: a
 * respondent draws or types in the link survey bundle → Next uploads one PNG through the private
 * storage route → the response holds its relative URL → the owner sees, downloads and exports it → and
 * deleting the response takes the PNG with it.
 *
 * Surveys are seeded through Prisma, and respondents run in their own browser contexts so the owner's
 * session cookie never reaches them.
 *
 * Storage is real here, not the mock the survey-builder specs install: deleting the response has to
 * make the object disappear, and the private URL has to demand the session. CI runs RustFS for this
 * (see e2e.yml); without S3 configured the whole file skips.
 */

const i18nValue = (value: string) => ({ default: value });

const SIGNATURE_URL_PATTERN = (workspaceId: string, surveyId: string, elementId: string) =>
  new RegExp(
    `^/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/signature--fid--[0-9a-f-]{36}\\.png$`
  );

// Next uploads the PNG before the card advances, so the next card can take longer than a plain click.
const UPLOAD_TIMEOUT = 30_000;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.skip(!process.env.S3_BUCKET_NAME, "The Signature journeys need real object storage (S3_BUCKET_NAME).");

type SeededSurvey = {
  surveyId: string;
  workspaceId: string;
  signatureId: string;
  /** The block-1 element's headline, to find its card in the summary. */
  headline: string;
};

const signatureElement = (id: string, headline: string, options: { required: boolean }) => ({
  id,
  type: TSurveyElementTypeEnum.Signature,
  headline: i18nValue(headline),
  required: options.required,
  allowTypedSignature: true,
});

const followUpElement = (id: string) => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: i18nValue("Anything else?"),
  required: false,
  inputType: "text" as const,
  charLimit: { enabled: false },
});

const createSurvey = async (
  owner: Awaited<ReturnType<UsersFixture["create"]>>,
  data: { name: string; blocks: TSurveyBlock[] }
): Promise<string> => {
  if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");

  const survey = await prisma.survey.create({
    data: {
      workspaceId: owner.workspaceId,
      createdBy: owner.id,
      name: data.name,
      type: "link",
      status: "inProgress",
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: data.blocks as unknown as Prisma.InputJsonValue[],
      endings: [
        { id: createId(), type: "endScreen", headline: i18nValue("Thank you!") },
      ] as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });

  return survey.id;
};

/** Block 1 holds the Signature; block 2 a text question, so block 1's button is "Next", not "Finish". */
const seedSignatureSurvey = async (
  owner: Awaited<ReturnType<UsersFixture["create"]>>,
  options: { name: string; required: boolean }
): Promise<SeededSurvey> => {
  const signatureId = createId();
  const headline = `${options.name}: please sign`;
  const surveyId = await createSurvey(owner, {
    name: options.name,
    blocks: [
      {
        id: createId(),
        name: "Block 1",
        elements: [signatureElement(signatureId, headline, options)],
      },
      { id: createId(), name: "Block 2", elements: [followUpElement(createId())] },
    ] as unknown as TSurveyBlock[],
  });

  return { surveyId, workspaceId: owner.workspaceId as string, signatureId, headline };
};

// ---- Respondent side ------------------------------------------------------------------------------

const signatureCard = (page: Page, elementId: string): Locator => page.locator(`div[id="${elementId}"]`);
const signaturePad = (card: Locator): Locator => card.getByRole("img", { name: /^Signature pad/ });
const signatureStatus = (card: Locator): Locator => card.getByRole("status");

/** A wavy two-pass stroke across the pad: long enough to count as signed. */
const waveAcross = (box: { x: number; y: number; width: number; height: number }) =>
  Array.from({ length: 24 }, (_, index) => {
    const progress = index / 23;
    return {
      x: box.x + box.width * (0.15 + 0.7 * progress),
      y: box.y + box.height * (0.5 + 0.25 * Math.sin(progress * Math.PI * 4)),
    };
  });

const padBox = async (pad: Locator) => {
  await expect(pad).toBeVisible();
  await pad.scrollIntoViewIfNeeded();
  // The survey's loading overlay covers the card for a moment after it renders, and raw mouse and CDP
  // touch events do not check what they land on. hover() waits until the pad itself receives events.
  await pad.hover();
  const box = await pad.boundingBox();
  if (!box) throw new Error("The signature pad has no layout box");
  return box;
};

const drawWithMouse = async (page: Page, pad: Locator): Promise<void> => {
  const [first, ...rest] = waveAcross(await padBox(pad));
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(point.x, point.y);
  await page.mouse.up();
};

const drawWithTouch = async (cdp: CDPSession, pad: Locator): Promise<void> => {
  const [first, ...rest] = waveAcross(await padBox(pad));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: first.x, y: first.y, id: 1 }],
  });
  for (const point of rest) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};

const openAsRespondent = async (
  browser: Browser,
  baseURL: string | undefined,
  options: { hasTouch?: boolean } = {}
) => {
  const context = await browser.newContext({ baseURL, ...options });
  return { context, page: await context.newPage() };
};

const startupFailures = (page: Page): string[] => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  return failures;
};

/** Counts the presigned-upload requests the survey bundle makes, so "no upload happened" is checkable. */
const trackStorageUploads = (page: Page): string[] => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/v[12]\/client\/[^/]+\/storage$/.test(new URL(request.url()).pathname)
    ) {
      uploads.push(request.url());
    }
  });
  return uploads;
};

/** The answer a response currently holds for an element, or "" while there is none. */
const readSignatureAnswer = async (surveyId: string, elementId: string): Promise<string> => {
  const responses = await prisma.response.findMany({ where: { surveyId }, select: { data: true } });
  const stored = responses
    .map((response) => (response.data as Record<string, unknown>)[elementId])
    .find((value) => typeof value === "string" && value !== "");
  return typeof stored === "string" ? stored : "";
};

/** The answer a response holds for an element. Responses are written asynchronously, so this polls. */
const waitForSignatureAnswer = async (surveyId: string, elementId: string): Promise<string> => {
  let answer = "";
  await expect
    .poll(
      async () => {
        answer = await readSignatureAnswer(surveyId, elementId);
        return answer;
      },
      { timeout: 30_000, message: "The signed response should be stored" }
    )
    .not.toBe("");
  return answer;
};

/** Respondent signs by drawing, answers nothing else and finishes. Returns the stored storage URL. */
const submitDrawnSignature = async (
  browser: Browser,
  baseURL: string | undefined,
  seeded: SeededSurvey
): Promise<string> => {
  const { context, page } = await openAsRespondent(browser, baseURL);
  try {
    await page.goto(`/s/${seeded.surveyId}`);
    const card = signatureCard(page, seeded.signatureId);
    await drawWithMouse(page, signaturePad(card));
    await expect(signatureStatus(card)).toHaveText("Signed");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    // Next creates the response; finishing while that request is still in flight can leave the survey
    // on "Sending responses…", so wait for the stored answer before pressing Finish.
    const answer = await waitForSignatureAnswer(seeded.surveyId, seeded.signatureId);
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Thank you!")).toBeVisible({ timeout: 60_000 });
    return answer;
  } finally {
    await context.close();
  }
};

// ---- PNG checks -----------------------------------------------------------------------------------

const readPngSize = (png: Buffer): { width: number; height: number } => {
  expect(png.subarray(0, 8).equals(PNG_MAGIC), "the body starts with the PNG signature").toBe(true);
  // The IHDR chunk follows the 8-byte signature: length(4) "IHDR"(4) width(4) height(4).
  expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

/** Decodes the PNG in the browser and reports its backdrop and ink, which the file header cannot tell. */
const inspectPixels = (page: Page, png: Buffer) =>
  page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2d context");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let inkPixels = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset] < 90 && data[offset + 1] < 90 && data[offset + 2] < 90) inkPixels += 1;
    }
    return { corner: Array.from(data.slice(0, 4)), inkPixels };
  }, png.toString("base64"));

/** A fetched signature must be the exported PNG: 900x300, opaque white page, dark ink. */
const expectSignaturePng = async (page: Page, png: Buffer) => {
  expect(readPngSize(png)).toEqual({ width: 900, height: 300 });
  const { corner, inkPixels } = await inspectPixels(page, png);
  expect(corner, "opaque white background").toEqual([255, 255, 255, 255]);
  expect(inkPixels, "the signature has ink").toBeGreaterThan(100);
};

/**
 * Clicks `trigger` until `target` shows. The owner pages hydrate after they paint, and a click that lands
 * first is dropped, so a single click followed by a visibility check can wait on a handler that never ran.
 */
const clickUntilVisible = async (trigger: Locator, target: Locator): Promise<void> => {
  await expect(async () => {
    if (!(await target.isVisible())) await trigger.click();
    await expect(target).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
};

const attachShot = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
};

// ---- Tests ----------------------------------------------------------------------------------------

test.describe("Signature element @slow", () => {
  test("a respondent signs by touch and by keyboard, and one PNG is uploaded per signature", async ({
    browser,
    baseURL,
    users,
  }, testInfo) => {
    const owner = await users.create({ skipSurveySeed: true });
    const seeded = await seedSignatureSurvey(owner, { name: "Touch signature", required: true });
    const { context, page } = await openAsRespondent(browser, baseURL, { hasTouch: true });
    const pageErrors = startupFailures(page);
    const uploads = trackStorageUploads(page);

    try {
      const cdp = await context.newCDPSession(page);
      const card = signatureCard(page, seeded.signatureId);
      const pad = signaturePad(card);
      const clear = card.getByRole("button", { name: "Clear" });

      await page.goto(`/s/${seeded.surveyId}`);

      await test.step("the pad starts empty, Draw is selected and Clear is unavailable", async () => {
        await expect(card.getByRole("tab", { name: "Draw" })).toHaveAttribute("aria-selected", "true");
        await expect(signatureStatus(card)).toHaveText("Not signed");
        await expect(clear).toBeDisabled();
        const box = await padBox(pad);
        expect(box.width / box.height).toBeCloseTo(3, 1);
      });

      await test.step("Next with nothing entered, or after a bare tap, shows the required error", async () => {
        const error = page.locator(`[id$="-error"]`).filter({ hasText: "Please fill out this field" });
        const next = page.getByRole("button", { name: "Next", exact: true });
        await next.click();
        await expect(error).toBeVisible();

        const box = await padBox(pad);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(signatureStatus(card)).toHaveText("Not signed");
        await next.click();
        await expect(error).toBeVisible();
        await expect(page.getByText("Anything else?")).toHaveCount(0);
        expect(uploads, "nothing is uploaded while the element is unanswered").toHaveLength(0);
      });

      await test.step("a finger stroke signs it, and Clear takes the signature back", async () => {
        await drawWithTouch(cdp, pad);
        await expect(signatureStatus(card)).toHaveText("Signed");
        await attachShot(page, testInfo, "touch-drawn");
        await clear.click();
        await expect(signatureStatus(card)).toHaveText("Not signed");
        await expect(clear).toBeDisabled();
      });

      await test.step("a second stroke signs again and Next uploads exactly one PNG", async () => {
        await drawWithTouch(cdp, pad);
        await expect(signatureStatus(card)).toHaveText("Signed");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Anything else?")).toBeVisible({ timeout: UPLOAD_TIMEOUT });
        expect(uploads).toHaveLength(1);
      });

      await test.step("the response already holds the relative private URL of the PNG", async () => {
        const answer = await waitForSignatureAnswer(seeded.surveyId, seeded.signatureId);
        expect(answer).toMatch(
          SIGNATURE_URL_PATTERN(seeded.workspaceId, seeded.surveyId, seeded.signatureId)
        );
      });

      await test.step("going back keeps the signature and Next does not upload it again", async () => {
        await page.getByRole("button", { name: "Back" }).click();
        await expect(signatureStatus(card)).toHaveText("Signed");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Anything else?")).toBeVisible({ timeout: UPLOAD_TIMEOUT });
        expect(uploads).toHaveLength(1);
      });

      await test.step("a keyboard-only respondent clears it and signs by typing, which replaces the stored PNG", async () => {
        const touchAnswer = await waitForSignatureAnswer(seeded.surveyId, seeded.signatureId);
        await page.getByRole("button", { name: "Back" }).click();
        await clear.click();
        await expect(signatureStatus(card)).toHaveText("Not signed");

        // The Type tab is reached and chosen with the keyboard alone, then Tab lands in the name field.
        const drawTab = card.getByRole("tab", { name: "Draw" });
        await drawTab.focus();
        await page.keyboard.press("ArrowRight");
        const typeTab = card.getByRole("tab", { name: "Type" });
        await expect(typeTab).toBeFocused();
        await expect(typeTab).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("Tab");
        const nameInput = card.getByRole("textbox", { name: "Type your name" });
        await expect(nameInput).toBeFocused();
        await page.keyboard.type("Ada Lovelace");
        await expect(signatureStatus(card)).toHaveText("Signed");
        await attachShot(page, testInfo, "typed-name");

        await page.getByRole("button", { name: "Next", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByText("Anything else?")).toBeVisible({ timeout: UPLOAD_TIMEOUT });
        expect(uploads).toHaveLength(2);

        await expect
          .poll(() => readSignatureAnswer(seeded.surveyId, seeded.signatureId), {
            timeout: 30_000,
            message: "the typed signature should replace the drawn one in the response",
          })
          .not.toBe(touchAnswer);
        expect(await readSignatureAnswer(seeded.surveyId, seeded.signatureId)).toMatch(
          SIGNATURE_URL_PATTERN(seeded.workspaceId, seeded.surveyId, seeded.signatureId)
        );
      });

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("the owner sees, downloads, summarises and exports the signature", async ({
    page,
    browser,
    baseURL,
    users,
  }, testInfo) => {
    const owner = await users.create({ skipSurveySeed: true });
    const seeded = await seedSignatureSurvey(owner, { name: "Owner view", required: false });

    // Two respondents: one signs, one passes over the optional element.
    const answer = await submitDrawnSignature(browser, baseURL, seeded);
    expect(answer).toMatch(SIGNATURE_URL_PATTERN(seeded.workspaceId, seeded.surveyId, seeded.signatureId));

    const skipper = await openAsRespondent(browser, baseURL);
    try {
      await skipper.page.goto(`/s/${seeded.surveyId}`);
      await expect(signaturePad(signatureCard(skipper.page, seeded.signatureId))).toBeVisible();
      await skipper.page.getByRole("button", { name: "Next", exact: true }).click();
      await expect.poll(() => prisma.response.count({ where: { surveyId: seeded.surveyId } })).toBe(2);
      await skipper.page.getByRole("button", { name: "Finish" }).click();
      await expect(skipper.page.getByText("Thank you!")).toBeVisible({ timeout: 60_000 });
    } finally {
      await skipper.context.close();
    }
    await expect.poll(() => prisma.response.count({ where: { surveyId: seeded.surveyId } })).toBe(2);

    await owner.login();
    const base = `/workspaces/${seeded.workspaceId}/surveys/${seeded.surveyId}`;

    await test.step("the private URL serves the exported PNG to the owner", async () => {
      const png = await page.context().request.get(answer);
      expect(png.status()).toBe(200);
      expect(png.headers()["content-type"]).toContain("image/png");
      await expectSignaturePng(page, await png.body());
    });

    await test.step("the Summary counts signed and skipped and lists the signature", async () => {
      await page.goto(`${base}/summary`);
      const summary = page.locator("div.rounded-xl").filter({ hasText: seeded.headline }).first();
      await expect(summary.getByText("Signed", { exact: true })).toBeVisible();
      await expect(summary.getByText("Skipped", { exact: true })).toBeVisible();
      await expect(summary.getByText("1 response", { exact: true })).toHaveCount(2);

      const thumbnails = summary.locator(
        '[data-testid="signature-summary-list"] li button[aria-label="Open response details"]'
      );
      await expect(thumbnails).toHaveCount(1);
      await attachShot(page, testInfo, "summary");
      await clickUntilVisible(thumbnails, page.getByTestId("signature-response"));
      await page.keyboard.press("Escape");
    });

    await test.step("the responses table shows the signature thumbnail", async () => {
      await page.goto(`${base}/responses`);
      const table = page.getByTestId("response-table").locator("table");
      await expect(table).toBeVisible();
      const thumbnail = table.locator('[data-testid="signature-response-thumbnail"]');
      await expect(thumbnail).toHaveCount(1);
      const image = thumbnail.getByRole("img", { name: "Signature" });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(900);
      await thumbnail.scrollIntoViewIfNeeded();
      await attachShot(page, testInfo, "table-thumbnail");
    });

    await test.step("the response card shows the image and downloads the same PNG", async () => {
      const card = page.getByTestId("signature-response");
      await clickUntilVisible(
        page.locator('[data-testid="signature-response-thumbnail"]').locator("xpath=ancestor::tr"),
        card
      );
      await expect(card.getByRole("img", { name: "Signature" })).toBeVisible();
      await attachShot(page, testInfo, "response-card");

      const download = card.locator('a[download="signature.png"]');
      await expect(download).toHaveText("Download PNG");
      const downloadPromise = page.waitForEvent("download");
      await download.click();
      const saved = await downloadPromise;
      expect(saved.suggestedFilename()).toBe("signature.png");
      const savedPath = testInfo.outputPath("signature.png");
      await saved.saveAs(savedPath);
      const downloaded = await readFile(savedPath);
      await expectSignaturePng(page, downloaded);
      const served = await page.context().request.get(answer);
      expect(downloaded.equals(await served.body()), "the download is the stored PNG").toBe(true);
      await page.keyboard.press("Escape");
    });

    await test.step("the CSV export carries the absolute URL in the Signature column", async () => {
      await page.getByRole("button", { name: "Download" }).click();
      await expect(page.getByTestId("fb__custom-filter-download-all-attachments")).toBeVisible();
      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("fb__custom-filter-download-all-csv").click();
      const csvDownload = await downloadPromise;
      const csvPath = testInfo.outputPath(csvDownload.suggestedFilename());
      await csvDownload.saveAs(csvPath);
      const csv = await readFile(csvPath, "utf-8");
      const [headerLine] = csv.split("\n");
      expect(headerLine).toContain(seeded.headline);
      expect(csv).toContain(`${baseURL}${answer}`);
    });
  });

  test("deleting a response deletes its PNG and leaves other signatures alone", async ({
    page,
    browser,
    baseURL,
    users,
  }) => {
    const owner = await users.create({ skipSurveySeed: true });
    const doomed = await seedSignatureSurvey(owner, { name: "Delete me", required: false });
    const bystander = await seedSignatureSurvey(owner, { name: "Keep me", required: false });
    const doomedUrl = await submitDrawnSignature(browser, baseURL, doomed);
    const bystanderUrl = await submitDrawnSignature(browser, baseURL, bystander);

    await owner.login();
    const request = page.context().request;

    await test.step("both PNGs are served to the owner before the delete", async () => {
      for (const url of [doomedUrl, bystanderUrl]) {
        const response = await request.get(url);
        expect(response.status(), url).toBe(200);
        expect(response.headers()["content-type"]).toContain("image/png");
      }
    });

    await test.step("deleting the response in the owner UI removes its PNG", async () => {
      await page.goto(`/workspaces/${doomed.workspaceId}/surveys/${doomed.surveyId}/responses`);
      const thumbnail = page.locator('[data-testid="signature-response-thumbnail"]');
      await expect(thumbnail).toHaveCount(1);
      const deleteResponse = page.getByRole("button", { name: "Delete response" });
      await clickUntilVisible(thumbnail.locator("xpath=ancestor::tr"), deleteResponse);
      await deleteResponse.click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(thumbnail).toHaveCount(0);

      await expect
        .poll(async () => (await request.get(doomedUrl)).status(), {
          timeout: 30_000,
          message: "the URL of a deleted response must stop serving the PNG",
        })
        .toBe(404);
    });

    await test.step("the other survey's signature still loads", async () => {
      const response = await request.get(bystanderUrl);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    });
  });
});
