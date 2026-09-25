import reactHooks from "@formbricks/config-eslint/react-hooks";

export default [
  ...reactHooks,
  {
    // Nearly every element in the templates is a react-email component, which jsx-a11y
    // skips unless it knows the intrinsic element it renders. Map only the ones that render
    // exactly one element whose rules apply (checked against react-email's dist). `Heading`
    // renders its `as` prop (default h1). `Html` is left out: it defaults `lang` to "en"
    // itself, so `html-has-lang` would flag every template.
    settings: {
      "jsx-a11y": {
        polymorphicPropName: "as",
        components: {
          Button: "a",
          Heading: "h1",
          Hr: "hr",
          Img: "img",
          Link: "a",
        },
      },
    },
  },
];
