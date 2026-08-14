import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch, fillRichTextEditor } from "./utils/helper";

/**
 * Embedded Data definitions in the survey editor (ENG-1837).
 *
 * The `EmbeddedData` / `SurveyEmbeddedData` tables are the read source of truth for Embedded Data
 * definitions (variables + hidden fields): readers resolve through the `embeddedFields` list inlined
 * onto the survey at load instead of reading `survey.variables` / `survey.hiddenFields`. The editor
 * is the one surface where those rows must NOT win: `localSurvey` is cloned once at mount and never
 * re-fetched, while the rows are only rewritten on save — so a reader resolving through them would
 * show pre-edit definitions until a reload.
 *
 * That regression is invisible on a survey with no rows (an empty inlined list falls back to the
 * cards anyway), so this spec deliberately saves first and reloads: from there on, `localSurvey`
 * carries real rows and every assertion below can tell "derived from the cards" apart from
 * "resolved through the rows".
 */

const QUESTION_HEADLINE = "Which plan are you on?";
const VARIABLE_NAME_PLACEHOLDER = "Field name e.g, score, price";

/**
 * Safe-identifier names (lowercase letters, digits and underscores, leading letter) with a random
 * suffix, so an assertion can never match a name another run left behind.
 */
const uniqueName = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** The editor's left panel. Scoping to it keeps the live preview's copies of the same text out. */
const editorPanel = (page: Page): Locator => page.getByRole("main");

/** Same label -> container walk as `fillRichTextEditor` (utils/helper.ts). */
const headlineEditor = (page: Page): Locator =>
  editorPanel(page).locator('label:has-text("Question*")').locator("..").locator("..");

/** The Variables card's forms in card order — one per variable, then the "create" form last. */
const variableForms = (page: Page): Locator =>
  editorPanel(page)
    .locator("form")
    .filter({ has: page.getByPlaceholder(VARIABLE_NAME_PLACEHOLDER) });

/**
 * Opens one of the editor's collapsible cards. Only one card is open at a time, so opening is
 * expressed as "click until its content is on screen": the click is a toggle, and asserting on the
 * content first keeps that idempotent whichever card was open before.
 */
const openCard = async (page: Page, name: "Variables" | "Hidden fields"): Promise<void> => {
  const content =
    name === "Variables"
      ? editorPanel(page).getByRole("button", { name: "Add variable", exact: true })
      : editorPanel(page).locator("#hiddenField");

  await expect(async () => {
    if (!(await content.isVisible())) {
      await editorPanel(page).getByText(name, { exact: true }).click();
    }
    await expect(content).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });
};

/**
 * Picks a variable's type and commits it. The card's edit forms submit on blur, so leaving the
 * select is what writes the change into `localSurvey`.
 */
const selectVariableType = async (page: Page, form: Locator, type: "Text" | "Number"): Promise<void> => {
  await form.getByRole("combobox").click();
  await page.getByRole("option", { name: type, exact: true }).click();
  const valueInput = form.getByPlaceholder("Initial value");
  await valueInput.click();
  await valueInput.press("Tab");
};

const addVariable = async (page: Page, name: string, type: "Text" | "Number"): Promise<void> => {
  const existingCount = await variableForms(page).count();
  const createForm = variableForms(page).last();

  await createForm.getByPlaceholder(VARIABLE_NAME_PLACEHOLDER).fill(name);
  await selectVariableType(page, createForm, type);
  await createForm.getByRole("button", { name: "Add variable", exact: true }).click();

  // The create form resets and the new variable renders its own edit form above it.
  await expect(variableForms(page)).toHaveCount(existingCount + 1);
  await expect(variableForms(page).first().getByPlaceholder(VARIABLE_NAME_PLACEHOLDER)).toHaveValue(name);
};

const renameVariable = async (page: Page, from: string, to: string): Promise<void> => {
  const form = variableForms(page).first();
  const nameInput = form.getByPlaceholder(VARIABLE_NAME_PLACEHOLDER);

  await expect(nameInput).toHaveValue(from);
  await nameInput.fill(to);
  // Blur commits the rename — the edit forms have no submit button.
  await nameInput.press("Tab");
  await expect(nameInput).toHaveValue(to);
};

const addHiddenField = async (page: Page, name: string): Promise<void> => {
  await openCard(page, "Hidden fields");
  await editorPanel(page).locator("#hiddenField").fill(name);
  await editorPanel(page).getByRole("button", { name: "Add hidden field ID", exact: true }).click();
  await expect(editorPanel(page).getByText(name, { exact: true })).toBeVisible();
};

/** Opens the element card if it is collapsed — same click-until-open shape as {@link openCard}. */
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
    const staleRowName = uniqueName("var_stale");
    const firstHiddenField = uniqueName("hidden_one");
    const secondHiddenField = uniqueName("hidden_two");

    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const surveyId = await createSurveyFromScratch(page);

    await openQuestionCard(page, "What would you like to know?");
    await fillRichTextEditor(page, "Question*", QUESTION_HEADLINE);

    // A text variable and a hidden field, declared on the legacy cards.
    await openCard(page, "Variables");
    await addVariable(page, variableName, "Text");
    await addHiddenField(page, firstHiddenField);

    // Persist them, which is what writes the EmbeddedData rows, then reload so the editor mounts
    // with those rows inlined on the survey. Everything below is asserted against that state — the
    // only one in which "reads the rows" and "derives from the cards" can disagree.
    await saveDraft(page);
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(2);

    // Force that disagreement rather than waiting for it: the saved row is edited behind the
    // editor's back so it claims a different name and a different type than the card does. This is
    // what an editor reader resolving through the rows would show, so every card-derived assertion
    // below now has something to be wrong about.
    const staleRowUpdate = await prisma.embeddedData.updateMany({
      where: { surveyId, source: "computed" },
      data: { name: staleRowName, dataType: "number" },
    });
    expect(staleRowUpdate.count).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(editorPanel(page).getByRole("heading", { name: QUESTION_HEADLINE })).toBeVisible();
    // The editor really was handed that row: the survey reaches this client component as a
    // serialized prop, so the stale name is in the payload even though no picker may show it.
    // Without this the assertions below could pass for the wrong reason (rows never inlined at all).
    expect(
      (await page.content()).includes(staleRowName),
      "the editor page should carry the diverging row in its serialized survey prop"
    ).toBe(true);

    // Baseline: the cards' definitions are offered, not the rows'.
    const pickerBeforeEdit = await openRecallPicker(page, "at-key");
    await expect(recallItem(pickerBeforeEdit, variableName)).toHaveAttribute("title", "variable");
    await expect(recallItem(pickerBeforeEdit, firstHiddenField)).toHaveAttribute("title", "hiddenField");
    await expect(recallItem(pickerBeforeEdit, staleRowName)).toHaveCount(0);
    await closeRecallPicker(page);

    await openBlockLogic(page);
    const operandsBeforeEdit = await openCombobox(page, "condition-0-0-conditionValue");
    await expect(operandsBeforeEdit.getByRole("option", { name: variableName, exact: true })).toBeVisible();
    await expect(operandsBeforeEdit.getByRole("option", { name: staleRowName, exact: true })).toHaveCount(0);
    await operandsBeforeEdit.getByRole("option", { name: firstHiddenField, exact: true }).click();

    await openCombobox(page, "action-0-objective");
    await page.getByRole("option", { name: "Calculate", exact: true }).click();
    const variablesBeforeEdit = await openCombobox(page, "action-0-variableId");
    await variablesBeforeEdit.getByRole("option", { name: variableName, exact: true }).click();
    // The card says text while the row says number, so this is the card's answer.
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "text");

    // Edit the definitions through the legacy cards: rename the variable, retype it to a number,
    // and declare a second hidden field. None of this touches the saved rows.
    await openCard(page, "Variables");
    await renameVariable(page, variableName, renamedVariableName);
    await selectVariableType(page, variableForms(page).first(), "Number");
    await addHiddenField(page, secondHiddenField);

    // Recall picker: the new name and the new hidden field, and no trace of the stale one.
    const pickerAfterEdit = await openRecallPicker(page, "toolbar");
    await expect(recallItem(pickerAfterEdit, renamedVariableName)).toHaveAttribute("title", "variable");
    await expect(recallItem(pickerAfterEdit, secondHiddenField)).toHaveAttribute("title", "hiddenField");
    await expect(recallItem(pickerAfterEdit, variableName)).toHaveCount(0);
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
    await expect(operandsAfterEdit.getByRole("option", { name: variableName, exact: true })).toHaveCount(0);
    await closeCombobox(page);

    // Calculate action: still bound to the same field (renaming keeps its id), now labelled with the
    // new name, and its value widget follows the field's new type.
    await expect(page.locator("#action-0-variableId")).toContainText(renamedVariableName);
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "number");

    // The edits survive a save and a reload, and the save is also what makes the rows catch up:
    // the deliberately stale row is rewritten from the card it belongs to.
    await saveDraft(page);
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(3);
    expect(await prisma.embeddedData.findFirst({ where: { surveyId, source: "computed" } })).toMatchObject({
      name: renamedVariableName,
      dataType: "number",
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await openCard(page, "Variables");
    await expect(variableForms(page).first().getByPlaceholder(VARIABLE_NAME_PLACEHOLDER)).toHaveValue(
      renamedVariableName
    );
    await openCard(page, "Hidden fields");
    await expect(editorPanel(page).getByText(firstHiddenField, { exact: true })).toBeVisible();
    await expect(editorPanel(page).getByText(secondHiddenField, { exact: true })).toBeVisible();

    await openBlockLogic(page);
    await expect(page.locator("#action-0-variableId")).toContainText(renamedVariableName);
    await expect(page.locator("#action-0-value-input")).toHaveAttribute("type", "number");
  });
});
