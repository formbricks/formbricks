# Formbricks

> still in development

Everything you always wanted (from a form tool)...

The days of scattered response data are counted. Manage all form data in one place. Analyze right here or pipe your data where you need it.

### How to run locally (for development)

To get the project running locally on your machine you need to have the following development tools installed:

- Node.JS (we recommend v18)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (to run PostgreSQL / MailHog)

1. Clone the project:

   ```sh
   git clone https://github.com/formbricks/formbricks
   ```

   and move into the directory

   ```sh
   cd formbricks
   ```

1. Install Node.JS packages via pnpm. Don't have pnpm? Get it [here](https://pnpm.io/installation)

   ```sh
   pnpm install
   ```

1. To make the process of installing a dev dependencies easier, we offer a [`docker-compose.yml`](https://docs.docker.com/compose/) with the following servers:

   - a `postgres` container and environment variables preset to reach it,
   - a `mailhog` container that acts as a mock SMTP server and shows received mails in a web UI (forwarded to your host's `localhost:8025`)

   ```sh
   docker-compose -f docker-compose.dev.yml up -d
   ```

1. Create a `.env` file based on `.env.example` and change it according to your setup. If you are using a cloud based database or another mail server, you will need to update the `DATABASE_URL` and SMTP settings in your `.env` accordingly.

   ```sh
   cp .env.example .env
   ```

1. Make sure your PostgreSQL Database Server is running. Then let prisma set up the database for you:

   ```sh
   pnpm prisma migrate dev
   ```

1. Start the development server:

   ```sh
   pnpm dev
   ```

   **You can now access the app on [http://localhost:3000](http://localhost:3000)**. You will be automatically redirected to the login. To use your local installation of formbricks, create a new account.

   For viewing the confirmation email and other emails the system sends you, you can access mailhog at [http://localhost:8025](http://localhost:8025)

### Build

To build all apps and packages, run the following command:

```sh
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```sh
pnpm dev
```
