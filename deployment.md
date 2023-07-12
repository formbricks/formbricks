The easiest way to deploy the Formbricks with HTTPS on your own server is using Docker and Traefik. Traefik is a reverse proxy that can be used to route traffic to your Formbricks instance. It can also be used to automatically generate SSL certificates using Let's Encrypt.
You can also use your own domain name and configure Traefik to use it.

## Install Docker

We are starting with a clean Ubuntu 22.04 server. First, we need to install Docker. You can find the official installation instructions here: https://docs.docker.com/engine/install/ubuntu/

First make sure you have no other Docker installation on your system and remove it:

```bash
$ sudo apt-get remove docker docker-engine docker.io containerd runc
```

Then install Docker. First update your package index:

```bash
sudo apt-get update
```

Then install the required packages:

```bash
sudo apt-get install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

Add Docker's official GPG key:

```bash
sudo mkdir -m 0755 -p /etc/apt/keyrings
```

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

Use then use the following command to set up the repository:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Update your package index again:

```bash
sudo apt-get update
```

Finally, install Docker:

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Test your Docker installation:

```bash
sudo docker run hello-world
```

If everything went well, you should see an output downloading the hello-world image and then running it.

To make interacting with docker easier, you also can add your current user to the docker group (that way you can avoid using sudo with docker commands). First create the group:

```bash
sudo groupadd docker
```

Then add your user to the group:

```bash
sudo usermod -aG docker $USER
```

Run this command to activate the changes to groups:

```bash
newgrp docker
```

## Install Traefik

We use Traefik as an easy to use webserver and to make all the models available to the outside under different domains. Traefik also takes care of automatically generating SSL certificates using Let's Encrypt.

First choose in which directory you want to install traefik and all the models we are hosting. We will use the root users home directory (`/root`) in this example.

Switch to home directory:

```bash
cd ~
```

Create a directory for traefik and switch to it:

```bash
mkdir traefik && cd traefik
```

Create a docker-compose.yml file:

```bash
touch docker-compose.yml
```

Open the file with your favorite editor (e.g. `nano docker-compose.yml`) and add the following content:

```yaml
version: "3.5"

services:
  traefik:
    image: "traefik:v2.7"
    restart: always
    container_name: "traefik"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /root/traefik/traefik.yaml:/traefik.yaml
      - /root/traefik/acme.json:/acme.json
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - web
networks:
  web:
    external: true
```

If you use a different directory, make sure to change the paths in the volumes section.

Create a traefik.yaml file:

```bash
touch traefik.yaml
```

Open the file with your favorite editor (e.g. `nano traefik.yaml`) and add the following content:

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: default
providers:
  docker:
    watch: true
    exposedByDefault: false
    network: web
certificatesResolvers:
  default:
    acme:
      email: YOUR-EMAIL-ADDRESS # TODO: replace with your email address
      storage: acme.json
      caServer: "https://acme-v01.api.letsencrypt.org/directory"
      tlsChallenge: {}
```

Make sure to replace `YOUR-EMAIL-ADDRESS` with your email address. This is required by Let's Encrypt to send you notifications about your certificates.

To store your SSL certificates locally, create a file called `acme.json`:

```bash
touch acme.json
```

And set the correct permissions:

```bash
chmod 600 acme.json
```

Now you can start traefik:

```bash
docker-compose up -d
```

You can check the status of traefik with:

```bash
docker-compose ps
```

You can also check the logs with:

```bash
docker-compose logs -f
```

Now that traefik is running, you can start other docker containers on your system and make them available to the outside world using traefik. Please make sure, that the ports 443 and 80 are accessible to the outside world and not blocked by your firewall or the firewall of your hoster.

## Setup Formbricks

Now that traefik is running, we can start setting up Formbricks.

First, move back to your base directory (in our case the roots home directory `/root` or `~`):

```bash
cd ~
```

Clone the repository and move into it:

```bash
git clone https://github.com/formbricks/formbricks.git && cd formbricks
```

Create a `.env` file based on `.env.docker` and change all fields according to your setup. This file comes with a basic setup and Formbricks works without making any changes to the file. To enable email sending functionality you need to configure the SMTP settings in the `.env` file. If you configured your email credentials, you can also comment the following lines to enable email verification (`# NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED=1`) and password reset (`# NEXT_PUBLIC_PASSWORD_RESET_DISABLED=1`)

Copy the `.env.docker` file to `.env` and edit it with an editor of your choice if needed.

```bash
cp .env.docker .env
```

Note: The environment variables are used at build time. When you change environment variables later, you need to rebuild the image with `docker compose build` for the changes to take effect.

Remove the existing `docker-compose.yml`:

```
rm docker-compose.yml
```

Now create and ppen the file with your favorite editor (e.g. `touch docker-compose.yml && nano docker-compose.yml`) and paste in this content:

```yaml
version: "3.3"
services:
  postgres:
    restart: always
    image: postgres:15-alpine
    volumes:
      - postgres:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=postgres
    networks:
      - formbricks

  formbricks:
    restart: always
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    depends_on:
      - postgres
    env_file:
      - .env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.formbricks.rule=Host(`api.example.com`)" # TODO: Change with your own domain
      - "traefik.http.routers.formbricks.tls.certresolver=default"
      - "traefik.http.routers.formbricks.entrypoints=websecure"
      - "traefik.http.services.formbricks.loadbalancer.server.port=3000"
    networks:
      - web
      - formbricks

volumes:
  postgres:
    driver: local
networks:
  formbricks:
  web:
    external: true
```

Make sure your domain is pointing to the IP address of your server. You can check your IP address with:

```bash
curl ifconfig.me
```

Finally start the docker compose process to build and spin up the Formbricks container as well as the PostgreSQL database.

```bash
docker compose up -d
# (use docker-compose if you are on an older docker version)
```

You can check the status of the containers with:

```bash
docker-compose ps
```

You can also check the logs with:

```bash
docker-compose logs -f
```

Formbricks should now be available under your domain 🎉🎉🎉
