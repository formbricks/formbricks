# Building React forms just got really easy 🤸

Every developer works with forms, few like their experience. Building Forms, especially in React, can be pretty annoying. State management, validation, form components, accessibility, internationalization and performance are all things you have to deal with, but don't really want to.

We make building - and maintaining - forms easier than ever in the world of React.

### Example

```jsx
import { Form, Text, Email, Checkbox, Submit } from "@formbricks/react";
import "@formbricks/react/styles.css";

export default function WaitlistForm() {
  return (
    <Form onSubmit={({ data, schema }) => console.log("data:", data, "schema:", schema)}>
      <Text name="name" label="What's your name?" validation="required" />
      <Email name="email" label="How can we reach you?" validation="email" />
      <Checkbox
        name="terms"
        label="Terms & Conditions"
        help="To use our service, please accept."
        validation="accepted"
      />
      <Submit label="Let's go!" />
    </Form>
  );
}
```

### Why is this easier already?

- One easy to use syntax for all input types
- HTML & non-HTML input types available out of the box
- Easily maintainable with component-based approach
- All characteristics adjustable via props
- Automatic schema generation

### What is to come?

- Conditional logic
- Multi-page forms
- Accessibility
- Internationalization
- Form templates (content & styles)

## Custom Styling (CSS & Tailwind)

Giving your form the right look and feel is very likely why you chose to use code. Formbricks React supports styling with a custom style sheet as well as Tailwind CSS.

### Custom Stylesheet

Simply create a style sheet, import it and add your CSS to these classes:

![Checkbox-input-form-survey-react-lib-easy-build-forms-fast-validation-multi-step](https://user-images.githubusercontent.com/72809645/203558901-c692fa28-6b8e-44c7-a381-0779fd85853c.png)

| CSS Class           | Description                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| formbricks-form     | The outermost wrapping element.                                                            |
| formbricks-outer    | A wrapper around the label input, help text and error messages.                            |
| formbricks-legend   | The legend (often a question)                                                              |
| formbricks-help     | The help text itself.                                                                      |
| formbricks-options  | A wrapper around all options.                                                              |
| formbricks-option   | A wrapper around each option.                                                              |
| formbricks-wrapper  | A wrapper around the label and the input field (no help text).                             |
| formbricks-label    | The label itself.                                                                          |
| formbricks-inner    | A wrapper around the input element.                                                        |
| formbricks-input    | The input element itself, here the radio button.                                           |
| formbricks-message  | The element (or many elements) containing a message — often validation and error messages. |
| formbricks-messages | A wrapper around all the messages.                                                         |

### Tailwind CSS

We love Tailwind! This is why Formbricks React natively supports Tailwind. All you have to do is target the classes using props. For example, to extend “formbricks-outer” class:

```jsx
<Text name="firstname" label="What's your first name?" outerClassName="bg-gray-800 my-5" />
```

### Overview of props to target CSS classes

Here are all the props you can use to extend the styling of the different form elements:

| CSS class           | Prop              | Content                                                      |
| ------------------- | ----------------- | ------------------------------------------------------------ |
| formbricks-form     | formClassName     | The wrapper around the complete form                         |
| formbricks-outer    | outerClassName    | The wrapper around label, input field and help text          |
| formbricks-legend   | legendClassName   | The label of the options group (only radio & checkbox input) |
| formbricks-help     | helpClassName     | The help text                                                |
| formbricks-options  | optionsClassName  | A wrapper around all options (only radio & checkbox input)   |
| formbricks-option   | optionClassName   | A wrapper around each option (only radio & checkbox input)   |
| formbricks-wrapper  | wrapperClassName  | The wrapper around the label and the input field             |
| formbricks-label    | labelClassName    | The label                                                    |
| formbricks-inner    | innerClassName    | The input field                                              |
| formbricks-input    | inputClassName    | The input                                                    |
| formbricks-message  | messageClassName  | The validation / error message itself                        |
| formbricks-messages | messagesClassName | Wrapper around all error messages                            |

## Validation & Error Messages

Validation prevents users from submitting missing of false data.

To add a validation to your inputs, add the `validation` prop and write the rules in string syntax. Rules are divided by a pipe (`|`), e.g.:

```jsx
<Text name="age" label="What's your age?" validation="required|number|min:0|max:100" />
```

| Rule     | Explanation                                                                | Example    |
| -------- | -------------------------------------------------------------------------- | ---------- |
| required | Only accepts non-empty fields                                              | “required” |
| number   | Only accepts fields with a number or float value                           | “number”   |
| min      | Only accepts number values that are greater or equal to the value provided | “min:10”   |
| max      | Only accepts number values that are greater or equal to the value provided | “max:50”   |
| accepted | Only accepts a truish value (true or 1)                                    | "accepted" |
| url      | Only accepts URLs e.g. "https://formbricks.com"                            | "url"      |
| email    | Only accepts email addresses                                               | "email"    |

## Docs

[Dive into the Docs](https://formbricks.com/docs) and join our Discord [to request features and report bugs.](https://formbricks.com/discord)

### Shoutout

The Formbricks React Library is built on top of [React Hook Form](https://react-hook-form.com/) to make use of their data handling and performance optimizations.

The developer experience is inspired by the great [FormKit for Vue.js](https://formkit.com/) Library.
