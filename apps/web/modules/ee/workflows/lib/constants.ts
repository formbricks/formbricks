// Long enough to batch a typing burst into one PATCH, short enough that edits are on the server
// before the user reaches for Test or navigates away. In a module of its own so the hook's tests can
// shorten it instead of waiting out real two-second windows (ENG-7529).
export const WORKFLOW_AUTOSAVE_DELAY_MS = 2000;
