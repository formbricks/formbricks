<p align="center">
<a href="https://github.com/formbricks/formbricks">
    <img src="https://user-images.githubusercontent.com/675065/203262290-3c2bc5b8-839c-468a-b675-e26a369c7fe2.png" alt="Logo" width="500">
  </a>
  <h3 align="center">Formbricks</h3>

  <p align="center">
    The Open Source Survey Toolbox
    <br />
    <a href="https://formbricks.com/">Website</a>  |  <a href="https://formbricks.com/discord">Join Discord community</a>
  </p>
</p>

<p align="center">
<a href="https://github.com/formbricks/formbricks/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple" alt="License"></a> <a href="https://formbricks.com/discord"><img src="https://img.shields.io/discord/979077669410979880?label=Discord&logo=discord&logoColor=%23fff" alt="Join Formbricks Discord"></a> <a href="https://github.com/formbricks/formbricks/stargazers"><img src="https://img.shields.io/github/stars/formbricks/formbricks?logo=github" alt="Github Stars"></a>
   <a href="https://news.ycombinator.com/item?id=32303986"><img src="https://img.shields.io/badge/Hacker%20News-122-%23FF6600" alt="Hacker News"></a>
   <a href="https://www.producthunt.com/products/snoopforms"><img src="https://img.shields.io/badge/Product%20Hunt-%232%20Product%20of%20the%20Day-orange?logo=producthunt&logoColor=%23fff" alt="Product Hunt"></a>
</p>

<br/>

> :octocat: Are you looking for snoopForms - the Open Source Typeform Alternative? We're building the next stage of the snoopForms evolution here with Formbricks - more modular, more open, and for all your form needs. If you still are looking for the code of snoopForms you can find it in the [snoopforms branch](https://github.com/formbricks/formbricks/tree/snoopforms).

> :warning: Repository still in progress `#buildinpublic`

## About Formbricks

![formbricks-twitter-header-open source forms and survey tools_smaller](https://user-images.githubusercontent.com/72809645/201055057-0883bbcf-86f2-4ea1-83f0-3a190a12f6cd.png)

We're building all essential form functionality so you don't have to. Modular, customizable, extendable. And open source.

### Mission: Stop rewriting existing code

We want to solve forms once and for all. If, in 10 years, a web developer rewrites core form functionality instead of building on top of our stack, we didn’t do our job. We want you to build your next big thing faster. Our big thing is the last form tool humanity needs. Hold us accountable!

[Read more in our blog](https://formbricks.com/blog/snoopforms-becomes-formbricks)

## Our Toolbox

Build a 'home-cooked' solution at the fraction of the time. We do the heavy lifting, you customize to your needs.

### React Forms Library

Building React forms has never been quicker. But there is more...

Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all the good stuff you want, but don't want to build yourself.
Building forms fast is great, but where do you pipe your data? And what is it worth without a schema?"

```jsx
import { Form, Text, Textarea, Submit } from "@formbricks/react";
import "@formbricks/react/styles.css";

export default function WaitlistForm() {
  return (
    <Form onSubmit={({ data, schema }) => console.log("data:", data, "schema:", schema)}>
      <Text name="firstname" label="What's your first name?" validation="required" />
      <Text name="lastname" label="What's your last name?" />
      <Textarea name="about" label="About you" help="Please keep it short" />
      <Submit name="submit" label="Submit" />
    </Form>
  );
}
```

[Get started with the React Library](https://formbricks.com/docs/react-form-library/introduction)

### Formbricks HQ - The OS form engine

Your form looks perfect? Time to build integrations...

Formbricks HQ is your backend for your submissions. Our main objective is versatility, so that you can use it with any currently existing form or survey. Soon we will integrate it with our React Form Builder. This allows for handling schemas so that you get a full image of your submission data.

<img width="1000" alt="Screenshot 2022-12-08 at 15 55 17" src="https://user-images.githubusercontent.com/675065/206478755-537ea73f-a7c9-4184-87a2-01c95586bc15.png">

### Features

- **Fast Form Creation**: Build complex forms with our React Lib. Our data pipes also work with any other form.
- **Data Pipelines**: Save your data where you need it. Use webhooks or pre-built integrations.
- **Powerful Data Insights**: View and manage your results quicker. Handle submissions in our dahsboard.
- **No-Code Builder**: Let your operators create and change forms. Stick with React to style and embed forms. `(coming soon)`
- **Built-in Analytics**: Opening rate, drop-offs, conversions. Use privacy-first analytics out of the box. `(coming soon)`
- **Survey Templates**: NPS, CSAT, Employee Surveys. Name your business objective, we have the questions. `(coming soon)`

### Why Formbricks

- **Futureproof**: Form needs change. With Formbricks you’ll avoid island solutions right from the start.
- **Privacy by design**: Self-host the entire product and fly through privacy compliance reviews.
- **Community driven**: We're building for you. If you need something specific, we’re happy to build it!
- **Great DX**: We love a solid developer experience. We felt your pain and do our best to avoid it.
- **Customizable**: We have to build opinionated. If it doesn't suit your need, just change it up.
- **Extendable**: Even though we try, we cannot build every single integration. With Formbricks, you can.

### Built With

- [Typescript](https://www.typescriptlang.org/)
- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Prisma](https://prisma.io/)

## Cloud vs. self-hosted

We offer you a ready hosted and maintained version of Formbricks HQ on [formbricks.com](https://hq.formbricks.com). It is currently in a open beta phase, free to use and always up to date. If you want to try Formbricks HQ, or save yourself the hassle and stress of self-hosting, this is the place to start.

The version of Formbricks HQ you'll find in this repository is the same version that runs in the cloud, and you can easily host it yourself on your servers. Check out our [docs](https://formbricks.com/docs/formbricks-hq/self-hosting) to see how to self-host Formbricks HQ.

(In the future we may develop additional features that aren't in the free Open-Source version)
