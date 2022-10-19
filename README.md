<p align="center">
<a href="https://github.com/formbricks/snoopforms">
    <img src="https://user-images.githubusercontent.com/72809645/172191504-808da997-025b-4b1f-90c0-b8ef658af2dd.svg" alt="Logo" width="500">
  </a>
  <h3 align="center">snoopForms</h3>

  <p align="center">
    Finally, good open-source forms!
    <br />
    <a href="https://snoopforms.com/">Website & Hosted version</a>  |  <a href="https://snoopforms.com/discord">Join Discord community</a>
  </p>
</p>

<p align="center">
<a href="https://github.com/formbricks/snoopforms/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-purple" alt="License"></a> <a href="https://discord.gg/3YFcABF2Ts"><img src="https://img.shields.io/discord/979077669410979880?label=Discord&logo=discord&logoColor=%23fff" alt="Join snoopForms Discord"></a> <a href="https://github.com/formbricks/snoopforms/stargazers"><img src="https://img.shields.io/github/stars/snoopForms/snoopforms?logo=github" alt="Github Stars"></a>
   <a href="https://news.ycombinator.com/item?id=32303986"><img src="https://img.shields.io/badge/Hacker%20News-122-%23FF6600" alt="Hacker News"></a>
   <a href="https://www.producthunt.com/products/snoopforms"><img src="https://img.shields.io/badge/Product%20Hunt-%232%20Product%20of%20the%20Day-orange?logo=producthunt&logoColor=%23fff" alt="Product Hunt"></a>
</p>

<br/>

## About snoopForms

<img width="937" alt="snoopForms-architecture" src="https://user-images.githubusercontent.com/675065/182550268-09794c9e-1187-470e-b795-697ceb2a93b8.svg">

Spin up forms in minutes. Pipe your data exactly where you need it. Maximize your results with juicy analytics.

## What is snoopForms?

With snoopForms you can build complex multi-page forms in minutes using either our built-in No Code Builder or our [React library](https://github.com/formbricks/snoopforms/tree/main/packages/snoopforms-react). All form submissions are automatically sent to the snoopForms platform for processing and analysis. You can view the submission within the platform or you can easily configure pipelines to send your data to other systems, services or databases.

### Features

- React Lib & No Code Builder to build & integrate forms rapidly.
- 100% compliant with all privacy regulations (self-hosted).
- (next) Put your data to work with integrations.
- (next) Juicy analytics out of the box.
- (always) smooth Developer Experience comes first.

### Built With

- [Typescript](https://www.typescriptlang.org/)
- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Prisma](https://prisma.io/)

## Cloud vs. self-hosted

We offer you a ready hosted and maintained version of snoopForms on [snoopforms.com](https://snoopforms.com). It is always up to date and offers a generous free plan. If you want to try snoopForms, or save yourself the hassle and stress of self-hosting, this is the place to start.

The version of snoopForms you'll find in this repository is the same version that runs in the cloud, and you can easily host it yourself on your servers. See the readme below for the deployment instructions.

(In the future we may develop additional features that aren't in the free Open-Source version)

## Get started with development

This repository is a monorepository using [Turborepo](https://turborepo.org/) and [pnpm](https://pnpm.io/). It contains the snoopForms [server application](https://github.com/formbricks/snoopforms/tree/main/apps/web), the [react library](https://github.com/formbricks/snoopforms/tree/main/packages/react) and other helper packages like database or UI library.

### How to run locally

To get the project running locally on your machine you need to have the following development tools installed:

- Node.JS (we recommend v16)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (to run PostgreSQL / MailHog)

1. Clone the project:

```bash
git clone https://github.com/formbricks/snoopforms.git
```

and move into the directory

```bash
cd snoopforms
```

2. Install Node.JS packages via pnpm. Don't have pnpm? Get it [here](https://pnpm.io/installation)

```bash
pnpm install
```

3. To make the process of installing a dev dependencies easier, we offer a [`docker-compose.yml`](https://docs.docker.com/compose/) with the following containers:

- a `postgres` container and environment variables preset to reach it,
- a `mailhog` container that acts as a mock SMTP server and shows received mails in a web UI (forwarded to your host's `localhost:8025`)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. Create a `.env` file based on `.env.example` and change it according to your setup. If you are using a cloud based database or another mail server, you will need to update the `DATABASE_URL` and SMTP settings in your `.env` accordingly.

```bash
cp .env.example .env
```

5. Make sure your PostgreSQL Database Server is running. Then let prisma set up the database for you:

```bash
pnpm dlx prisma migrate dev
```

6. Start the development server:

```bash
pnpm dev
```

**You can now access the app on [https://localhost:3000](https://localhost:3000)**. You will be automatically redirected to the login. To use your local installation of snoopForms, create a new account.

For viewing the confirmation email and other emails the system sends you, you can access mailhog at [https://localhost:8025](https://localhost:8025)

## Deployment for Production Setup

The easiest way to deploy snoopForms on your own machine is using Docker. This requires Docker and the docker compose plugin on your system to work.

Clone the repository:

```bash
git clone https://github.com/formbricks/snoopforms.git && cd snoopforms
```

Create a `.env` file based on `.env.docker` and change all fields according to your setup. This file comes with a basic setup and snoopForms works without making any changes to the file. To enable email sending functionality you need to configure the SMTP settings in the `.env` file. If you configured your email credentials, you can also comment the following lines to enable email verification (`# NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED=1`) and password reset (`# NEXT_PUBLIC_PASSWORD_RESET_DISABLED=1`)

Copy the `.env.docker` file to `.env` and edit it with an editor of your choice if needed.

```bash
cp .env.docker .env
```

Note: The environment variables are used at build time. When you change environment variables later, you need to rebuild the image with `docker compose build` for the changes to take effect.

Finally start the docker compose process to build and spin up the snoopForms container as well as the PostgreSQL database.

```bash
docker compose up -d
# (use docker-compose if you are on an older docker version)
```

You can now access the app on [https://localhost:3000](https://localhost:3000). You will be automatically redirected to the login. To use your local installation of snoopForms, create a new account.

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a pull request

## License

Distributed under the AGPLv3 License. See `LICENSE` for more information.
