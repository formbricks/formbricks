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

> :warning: **Note**: This repository is still in an early stage of development. We love the open source community and want to show what we are working on early. We will update this readme with more information once it is safe to use. Until then, feel free to share your thoughts, contact us, and contribute if you'd like.

<br/>

## About snoopForms

<img width="937" alt="snoopForms-architecture" src="https://user-images.githubusercontent.com/675065/182550268-09794c9e-1187-470e-b795-697ceb2a93b8.svg">

Spin up forms in minutes. Pipe your data exactly where you need it. Maximize your results with juicy analytics.

## What is snoopForms?

With snoopForms you can build complex multi-page forms in minutes using either our built-in No Code Builder or our [React library](https://github.com/formbricks/snoopforms-react). All form submissions are automatically sent to the snoopForms platform for processing and analysis. You can view the submission within the platform or you can easily configure pipelines to send your data to other systems, services or databases.

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

## Getting started

you can develop in a VS Code [dev container](https://code.visualstudio.com/docs/remote/containers) or using any editor/IDE with local tool installation.

### Getting started using VS Code dev container

You need

- Docker, e.g. [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [VS Code](https://code.visualstudio.com/download) with the extension [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) (`ms-vscode-remote.remote-containers`)

Either use the command `Open Folder in Container...` in the cloned repo, or use `Remote Containers: Clone Repository in Container Volume...`, for example to inspect a PR.

The dev container comes with

- Node.JS, yarn etc pre-installed
- a `postgres` container and environment variables preset to reach it,
- a `mailhog` container that acts as a mock SMTP server and shows received mails in a web UI (forwarded to your host's `localhost:8025`)

upon start, it executes the `yarn install` and `yarn prisma migrate dev` automatically once.

When your dev container is ready, you can simply hit `F5` to start the application in debug mode.

### Getting started using local development setup

To get the project running locally on your machine you need to have the following development tools installed:

- Node.JS (we recommend v16)
- Yarn
- PostgreSQL

1. Clone the project:

```
git clone https://github.com/formbricks/snoopforms.git && cd snoopforms
```

2. Install Node.JS packages via yarn. Don't have yarn? Use `npm install --global yarn`.

```
yarn install
```

3. Make sure you have a running database instance, e.g. by using docker. A quick and dirty instance can be spun up via:

```
docker run --name snoopformsDB -p 5432:5432 -e POSTGRES_USER=snoopforms -e POSTGRES_PASSWORD=password -e POSTGRES_DB=snoopforms -d postgres
```

4. Create a `.env` file based on `.env.example` and change it according to your setup. Make sure the `DATABASE_URL` variable is set correctly according to your local database.

```
cp .env.example .env
```

For the example above, use the following:

```
DATABASE_URL='postgresql://snoopforms:password@localhost:5432/snoopforms?schema=public'
```

5. Use the code editor of your choice to edit the .env file. You need to change all fields according to your setup.

6. Make sure your PostgreSQL Database Server is running. Then let prisma set up the database for you:

```
yarn prisma migrate dev
```

7. Start the development server:

```
yarn dev
```

**You can now access the app on [https://localhost:3000](https://localhost:3000)**. You will be automatically redirected to the login. To use your local installation of snoopForms, create a new account.

## Deployment

The easiest way to deploy the snoopHub on your own machine is using Docker. This requires Docker and the docker compose plugin on your system to work.

Clone the repository:

```

git clone https://github.com/formbricks/snoopforms.git && cd snoopforms

```

Create a `.env` file based on `.env.example` and change all fields according to your setup. The SMTP-credentials are essential for verification emails to work during user signup.

```

cp .env.example .env && nano .env

```

Start the docker compose process to build and spin up the snoopForms container as well as the postgres database.

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
