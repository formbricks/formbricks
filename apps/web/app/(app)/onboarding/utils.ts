// util.js
export const handleTabNavigation = (fieldsetRef, setSelectedChoice) => (event) => {
  if (event.key !== "Tab") {
    return;
  }

  event.preventDefault();

  const radioButtons = fieldsetRef.current?.querySelectorAll('input[type="radio"]');
  if (!radioButtons || radioButtons.length === 0) {
    return;
  }

  const focusedRadioButton = fieldsetRef.current?.querySelector(
    'input[type="radio"]:focus'
  ) as HTMLInputElement;

  if (!focusedRadioButton) {
    // If no radio button is focused, focus on the first one by default
    const firstRadioButton = radioButtons[0] as HTMLInputElement;
    firstRadioButton.focus();
    setSelectedChoice(firstRadioButton.value);
    return;
  }

  const focusedIndex = Array.from(radioButtons).indexOf(focusedRadioButton);
  const lastIndex = radioButtons.length - 1;

  // Calculate the next index, considering wrapping from the last to the first element
  const nextIndex = focusedIndex === lastIndex ? 0 : focusedIndex + 1;
  const nextRadioButton = radioButtons[nextIndex] as HTMLInputElement;
  nextRadioButton.focus();
  setSelectedChoice(nextRadioButton.value);
};
