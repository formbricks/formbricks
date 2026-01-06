/**
 * Count the number of actual selections in a multi-select value array.
 *
 * The value array format for MultiSelect:
 * - Regular options: ["Label1", "Label2"]
 * - With "other" option: ["Label1", "", "custom other text"]
 *   - The "" sentinel indicates "other" is selected
 *   - The text following it is the custom value
 *
 * This function counts logical selections, not array length.
 */
export const countSelections = (value: unknown[]): number => {
    if (!Array.isArray(value) || value.length === 0) {
        return 0;
    }

    const hasOtherSentinel = value.includes("");
    let count = 0;

    for (let i = 0; i < value.length; i++) {
        const item = value[i];

        // Skip empty sentinel
        if (item === "") {
            continue;
        }

        // Skip the value immediately after empty sentinel (it's the "other" custom text)
        if (i > 0 && value[i - 1] === "") {
            continue;
        }

        count++;
    }

    // Add 1 for "other" if it's selected (the sentinel + optional text count as 1 selection)
    if (hasOtherSentinel) {
        count++;
    }

    return count;
};


