import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import {
  type EmbeddedFieldSource,
  addEmbeddedField,
  createSurveyFromScratch,
  editEmbeddedField,
  editorPanel,
  embeddedFieldRow,
  fillEmbeddedFieldDialog,
  fillRichTextEditor,
  openEmbeddedDataCard,
} from "./utils/helper";

/**
 * Embedded Data definitions in the survey editor (ENG-1837, ENG-2628, ENG-1851).
 *
 * The `EmbeddedData` / `SurveyEmbeddedData` tables are the read source of truth for Embedded Data
 * definitions: readers resolve through the `embeddedFields` list inlined onto the survey at load
 * instead of reading `survey.variables` / `survey.hiddenFields`. ENG-1837 made the editor the one
 * exception — its cards owned the legacy columns, so every editor surface had to derive from them or
 * show pre-edit definitions until the next save.
 *
 * ENG-2628 removed that exception by removing the second description: the cards edited
 * `embeddedFields` itself, and every editor surface read it like every runtime reader does. ENG-1851
 * then replaced the two cards with **one Embedded Data card** over that same list, so the rows win
 * here too and a card edit still reaches the pickers on the next render.
 *
 * Neither half is observable on a survey with no rows (an empty inlined list falls back to the legacy
 * columns anyway), so this spec deliberately saves first and reloads: from there on, `localSurvey`
 * carries real rows and every assertion below can tell "reads the rows" apart from "derives from the
 * legacy columns".
 */

const QUESTION_HEADLINE = "Which plan are you on?";

/**
 * Safe-identifier names (lowercase letters, digits and underscores, leading letter) with a random
 * suffix, so an assertion can never match a name another run left behind.
 */
const uniqueName = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** Same label -> container walk as `fillRichTextEditor` (utils/helper.ts). */
const headlineEditor = (page: Page): Locator =>
  editorPanel(page).locator('label:has-text("Question*")').locator("..").locator("..");

/** Opens the new-field dialog with its source already picked. */
const openNewFieldDialog = async (page: Page, source: EmbeddedFieldSource): Promise<Locator> => {
  await openEmbeddedDataCard(page);
  await editorPanel(page).getByRole("button", { name: "New field", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await fillEmbeddedFieldDialog(page, { source });
  return dialog;
};

/**
 * Submits the open dialog under `name` and expects the reserved-name refusal.
 *
 * `label` is the namespace the refusal names: the merged card still authors into the two namespaces
 * recall and logic address fields through, so a calculated field is refused as a variable and a
 * passed-in one as a hidden field.
 */
const expectReservedNameRefused = async (
  page: Page,
  name: string,
  label: "Hidden field" | "Variable"
): Promise<void> => {
  const dialog = page.getByRole("dialog");

  await fillEmbeddedFieldDialog(page, { name });
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  // Inline under the field rather than a toast — that is how the dialog reports name errors.
  await expect(
    dialog.getByText(`${label} ID "${name}" is not allowed. It is a reserved keyword.`, { exact: true })
  ).toBeVisible();
  await expect(
    editorPanel(page).getByTestId("embedded-field-row"),
    "a refused name must not reach the card"
  ).toHaveCount(0);
};

/** Adds the field the open dialog is filled for, and waits for its row. */
const addFieldFromOpenDialog = async (page: Page, name: string): Promise<void> => {
  await fillEmbeddedFieldDialog(page, { name });
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(embeddedFieldRow(page, name)).toBeVisible();
};

/** Opens the element card if it is collapsed — same click-until-open shape as `openEmbeddedDataCard`. */
const openQuestionCard = async (page: Page, heading = QUESTION_HEADLINE): Promise<void> => {
  const questionLabel = editorPanel(page).locator('label:has-text("Question*")');

  await expect(async () => {
    if (!(await questionLabel.isVisible())) {
      await editorPanel(page).getByRole("heading", { name: heading }).click();
    }
    await expect(questionLabel).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });
};

/**
 * Opens the recall picker on the question headline. Both entry points are covered: the `@` key the
 * ticket names, and the editor toolbar's "Recall data" button.
 */
const openRecallPicker = async (page: Page, via: "at-key" | "toolbar"): Promise<Locator> => {
  await openQuestionCard(page);

  if (via === "at-key") {
    const input = headlineEditor(page).locator(".editor-input").first();
    await input.click();
    await input.press("End");
    await input.press("@");
  } else {
    await headlineEditor(page).getByRole("button", { name: "Recall data", exact: true }).click();
  }

  const picker = page.locator("[data-recall-dropdown]");
  await expect(picker).toBeVisible();
  return picker;
};

const closeRecallPicker = async (page: Page): Promise<void> => {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-recall-dropdown]")).toBeHidden();
};

const recallItem = (picker: Locator, name: string): Locator =>
  picker.getByRole("menuitem", { name, exact: true });

/** Opens the block's conditional logic, adding the first rule when the block has none yet. */
const openBlockLogic = async (page: Page): Promise<void> => {
  await openQuestionCard(page);

  const showSettings = editorPanel(page).getByText("Show Block settings", { exact: true });
  if (await showSettings.isVisible().catch(() => false)) {
    await showSettings.click();
  }
  await expect(editorPanel(page).getByText("Hide Block settings", { exact: true })).toBeVisible();

  const firstConditionOperand = page.locator("#condition-0-0-conditionValue");
  if (await firstConditionOperand.isVisible().catch(() => false)) return;

  const logicSection = editorPanel(page).getByRole("button", { name: "Conditional Logic" });
  if (await logicSection.isVisible().catch(() => false)) {
    await logicSection.click();
  } else {
    await editorPanel(page).locator("#logicJumps").click();
  }
  await expect(firstConditionOperand).toBeVisible();
};

const openCombobox = async (page: Page, id: string): Promise<Locator> => {
  await page.locator(`#${id}`).click();
  const menu = page.getByTestId("dropdown-menu-content");
  await expect(menu).toBeVisible();
  return menu;
};

const closeCombobox = async (page: Page): Promise<void> => {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dropdown-menu-content")).toBeHidden();
};

const saveDraft = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Save as draft", exact: true }).click({ noWaitAfter: true });
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
};

test.describe("Survey editor Embedded Data definitions @slow", () => {
  test.setTimeout(1000 * 60 * 3);

  test("card edits reach the recall, logic and calculate pickers without a reload", async ({
    page,
    users,
  }) => {
    const variableName = uniqueName("var_alpha");
    const renamedVariableName = uniqueName("var_beta");
    const rowEditedName = uniqueName("var_row");
    const firstHiddenField = uniqueName("hidden_one");
    const secondHiddenField = uniqueName("hidden_two");

    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const surveyId = await createSurveyFromScratch(page);

    await openQuestionCard(page, "What would you like to know?");
    await fillRichTextEditor(page, "Question*", QUESTION_HEADLINE);

    // A calculated field and a passed-in one, both declared on the one card.
    await addEmbeddedField(page, { name: variableName, source: "Calculated", type: "Text" });
    await addEmbeddedField(page, { name: firstHiddenField, source: "Passed in", type: "Text" });

    // Persist them, which is what writes the EmbeddedData rows, then reload so the editor mounts
    // with those rows inlined on the survey. Everything below is asserted against that state — the
    // only one in which "reads the rows" and "derives from the cards" can disagree.
    await saveDraft(page);
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(2);

    // Pull the two descriptions apart rather than waiting for them to drift: the saved row is edited
    // behind the editor's back so it claims a different name and a different type than the legacy
    // column derived from it does. Whichever one the editor reads, the other is now wrong about
    // something — which is what every assertion below reads off.
    const rowUpdate = await prisma.embeddedData.updateMany({
      where: { surveyId, source: "computed" },
      data: { name: rowEditedName, dataType: "number" },
    });
    expect(rowUpdate.count).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(editorPanel(page).getByRole("heading", { name: QUESTION_HEADLINE })).toBeVisible();

    // Baseline: the rows' definitions are offered, and the legacy column's name is nowhere. Before
    // ENG-2628 this pair was the other way round.
    const pickerBeforeEdit = await openRecallPicker(page, "at-key");
    await expect(recallItem(pickerBeforeEdit, rowEditedName)).toHaveAttribute("title", "variable");
    await expect(recallItem(pickerBeforeEdit, firstHiddenField)).toHaveAttribute("title", "hiddenField");
    await expect(recallItem(pickerBeforeEdit, variableName)).toHaveCount(0);
    await closeRecallPicker(page);

    // The card edits the same list it reads, so it names the row too.
    await openEmbeddedDataCard(page);
    await expect(embeddedFieldRow(page, rowEditedName)).toBeVisible();

    await openBlockLogic(page);
    const operandsBeforeEdit = await openCombobox(page, "condition-0-0-conditionValue");
    await expect(operandsBeforeEdit.getByRole("option", { name: rowEditedName, exact: true })).toBeVisible();
    await expect(operandsBeforeEdit.getByRole("option", { name: variableName, exact: true })).toHaveCount(0);
    await operandsBeforeEdit.getByRole("option", { name: firstHiddenField, exact: true }).click();

    await openCombobox(page, "action-0-objective");
    await page.getByRole("option", { name: "Calculate", exact: true }).click();
    const variablesBeforeEdit = await openCombobox(page, "action-0-variableId");
    await variablesBeforeEdit.getByRole("option", { name: rowEditedName, exact: true }).click();
    // The row says number while the legacy column still says text, so this is the row's answer.
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "number");

    // Now edit through the card: rename the calculated field, retype it back to text, and declare a
    // second passed-in field. The card writes `embeddedFields`, which is what every reader below is
    // reading — so this must land with no save and no reload.
    await editEmbeddedField(page, rowEditedName, { name: renamedVariableName, type: "Text" });
    await addEmbeddedField(page, { name: secondHiddenField, source: "Passed in" });

    // Recall picker: the new name and the new passed-in field, and no trace of the name it replaced.
    const pickerAfterEdit = await openRecallPicker(page, "toolbar");
    await expect(recallItem(pickerAfterEdit, renamedVariableName)).toHaveAttribute("title", "variable");
    await expect(recallItem(pickerAfterEdit, secondHiddenField)).toHaveAttribute("title", "hiddenField");
    await expect(recallItem(pickerAfterEdit, rowEditedName)).toHaveCount(0);
    await closeRecallPicker(page);

    // Logic operand picker: same, live.
    await openBlockLogic(page);
    const operandsAfterEdit = await openCombobox(page, "condition-0-0-conditionValue");
    await expect(
      operandsAfterEdit.getByRole("option", { name: renamedVariableName, exact: true })
    ).toBeVisible();
    await expect(
      operandsAfterEdit.getByRole("option", { name: secondHiddenField, exact: true })
    ).toBeVisible();
    await expect(operandsAfterEdit.getByRole("option", { name: rowEditedName, exact: true })).toHaveCount(0);
    await closeCombobox(page);

    // Calculate action: still bound to the same field (renaming keeps its address), now labelled with
    // the new name, and its value widget follows the field's new type.
    await expect(page.locator("#action-0-variableId")).toContainText(renamedVariableName);
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "text");

    // The edits survive a save and a reload, and the save is what writes the card's answer back onto
    // the row — including over the type the behind-the-back edit put there.
    await saveDraft(page);
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(3);
    expect(await prisma.embeddedData.findFirst({ where: { surveyId, source: "computed" } })).toMatchObject({
      name: renamedVariableName,
      dataType: "string",
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await openEmbeddedDataCard(page);
    await expect(embeddedFieldRow(page, renamedVariableName)).toBeVisible();
    await expect(embeddedFieldRow(page, firstHiddenField)).toBeVisible();
    await expect(embeddedFieldRow(page, secondHiddenField)).toBeVisible();

    await openBlockLogic(page);
    await expect(page.locator("#action-0-variableId")).toContainText(renamedVariableName);
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "text");
  });

  /**
   * ENG-1839. `country` is a Tier-1 reserved field, read off every response. A newly declared
   * passed-in field may not take that name — the two would collide in the recall/logic namespace, and
   * `getHiddenFieldsFromSearchParams` would refuse to fill it, leaving it silently empty forever.
   *
   * Surveys that ALREADY declare `country` are grandfathered and keep working; that half is covered
   * below the browser boundary (service, v3 patch and reconcile suites), because reaching it here
   * would mean authoring a state the editor now refuses to create.
   */
  test("refuses a hidden field named after a reserved field", async ({ page, users }) => {
    const allowedName = uniqueName("plan_tier");

    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const surveyId = await createSurveyFromScratch(page);

    await openNewFieldDialog(page, "Passed in");
    await expectReservedNameRefused(page, "country", "Hidden field");
    // Uppercase is refused too: the reserved match is case-insensitive, and a survey declaring
    // `Country` would collide with the same reserved read.
    await expectReservedNameRefused(page, "Country", "Hidden field");

    // An ordinary name still works, so the guard rejects the reserved name rather than the dialog.
    await addFieldFromOpenDialog(page, allowedName);

    // And the refusal really did not reach the database: the save writes one field, not three.
    await saveDraft(page);
    const stored = await prisma.surveyEmbeddedData.findMany({
      where: { surveyId },
      select: { storageKey: true },
    });
    expect(stored.map((field) => field.storageKey)).toEqual([allowedName]);
  });

  /**
   * The calculated half of the same guard. `isSafeIdentifier("country")` passes — it is lowercase
   * with no separators — so the old Variables card accepted the name and the author only found out at
   * save time, from the server guard's untranslated message. The one card applies the same
   * `validateId` strict gate to both sources, so the refusal is translated and immediate either way.
   */
  test("refuses a variable named after a reserved field", async ({ page, users }) => {
    const allowedName = uniqueName("score");

    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const surveyId = await createSurveyFromScratch(page);

    await openNewFieldDialog(page, "Calculated");
    await expectReservedNameRefused(page, "country", "Variable");
    await expectReservedNameRefused(page, "Country", "Variable");
    await addFieldFromOpenDialog(page, allowedName);

    await saveDraft(page);
    // Asserted on the definition, not on the link's `storageKey`: a calculated field is addressed by
    // its cuid everywhere, so the card mints that id as the storage key while the name — the only
    // thing this gate reads — lives on the definition. A passed-in field's two happen to be equal,
    // which is why the sibling test above can compare storage keys directly.
    const stored = await prisma.surveyEmbeddedData.findMany({
      where: { surveyId },
      select: { embeddedData: { select: { name: true, source: true } } },
    });
    expect(stored.map((link) => link.embeddedData)).toEqual([{ name: allowedName, source: "computed" }]);
  });
});
