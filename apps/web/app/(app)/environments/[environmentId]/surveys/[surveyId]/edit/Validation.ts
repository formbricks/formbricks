// extend this object in order to add more validation rules 

 const validationRules = {
    multipleChoiceMulti: (question: any) => {
      return !question.choices.some((element: any) => element.label.trim() === "");
    },
    multipleChoiceSingle: (question: any) => {
      return !question.choices.some((element: any) => element.label.trim() === "");
    },
    defaultValidation: (question: any) => {
      return question.headline.trim() !== "";
    },
  };

  const validateQuestion = (question) => {
    const specificValidation = validationRules[question.type];
    const defaultValidation = validationRules.defaultValidation;

    const specificValidationResult = specificValidation ? specificValidation(question) : true;
    const defaultValidationResult = defaultValidation(question);

    // Return true only if both specific and default validation pass
    return specificValidationResult && defaultValidationResult;
  };



export {validationRules, validateQuestion}