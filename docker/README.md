# Formbricks Quickstart Using Docker

Follow the instructions below to quickly get Formbricks running on your system with Docker. This guide is designed for most users who want a straightforward setup process.

1. **Create a New Directory for Formbricks**

   Open a terminal and create a new directory for Formbricks, then navigate into this new directory:

   ```bash
   mkdir formbricks-quickstart && cd formbricks-quickstart
   ```

2. **Download the Docker-Compose File**

   Download the docker-compose file directly from the Formbricks repository:

   ```bash
   curl -o docker-compose.yml https://raw.githubusercontent.com/formbricks/formbricks/docker/main/docker-compose.yml
   ```

3. **Generate NextAuth Secret**

   Next, you need to generate a NextAuth secret. This will be used for session signing and encryption. The `sed` command below generates a random string using `openssl`, then replaces the `NEXTAUTH_SECRET:` placeholder in the `docker-compose.yml` file with this generated secret:

   ```bash
   sed -i "/NEXTAUTH_SECRET:$/s/NEXTAUTH_SECRET:.\*/NEXTAUTH_SECRET: $(openssl rand -base64 32)/" docker-compose.yml
   ```

4. **Start the Docker Setup**

   You're now ready to start the Formbricks Docker setup. The following command will start Formbricks together with a postgreSQL database using Docker Compose:

   ```bash
   docker compose up -d
   ```

   The `-d` flag will run the containers in detached mode, meaning they'll run in the background.

5. **Visit Formbricks in Your Browser**

   After starting the Docker setup, visit http://localhost:3000 in your browser to interact with the Formbricks application. The first time you access this page, you'll be greeted by a setup wizard. Follow the prompts to define your first user and get started.

Enjoy using Formbricks!

Note: For detailed documentation of local setup, take a look at our [self hosting docs](https://formbricks.com/docs/self-hosting/deployment)
