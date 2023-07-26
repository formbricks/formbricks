# Self Host Formbricks Production Instance

Follow this guide to get your Formbricks instance up and running with a Postgres DB and SSL certificate using a single script:

## PreRequisites

Before you proceed, make sure you have the following prerequisites:

- A Linux Ubuntu Virtual Machine deployed with SSH access.

- An A record set up to connect a custom domain to your instance. Formbricks will automatically create an SSL certificate for your domain using LetsEncrypt.

## Single Command Setup

Copy and paste the following command into your terminal:

```bash
/bin/sh -c "$(curl -fsSL https://raw.githubusercontent.com/formbricks/formbricks/main/docker/production.sh)"
```

The script will prompt you for the following information:

1. **Overwriting Docker GPG Keys**: If Docker GPG keys already exist, the script will ask if you want to overwrite them.

2. **Email Address**: Provide your email address for SSL certificate registration with LetsEncrypt.

3. **Domain Name**: Enter the domain name that Traefik will use to create the SSL certificate and forward requests to Formbricks.

That's it! After running the command and providing the required information, visit the domain name you entered, and you should see the Formbricks home wizard!

### Troubleshooting

If you encounter any issues, consider the following steps:

- **Inbound Rules**: Make sure you have added inbound rules for Port 80 and 443 in your VM's Security Group.

- **A Record**: Verify that you have set up an A record for your domain, pointing to your VM's IP address.

- **Check Docker Instances**: Run `docker ps` to check the status of the Docker instances.

- **Check Formbricks Logs**: Run `cd formbricks && docker compose logs` to check the logs of the Formbricks stack.

Note: For detailed documentation of local setup, take a look at our [self hosting docs](https://formbricks.com/docs/self-hosting/deployment)
