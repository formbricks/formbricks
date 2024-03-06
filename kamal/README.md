# Kamal Setup

1. Initiate a Linux instance & Get it's 
   - Public IP address
   - SSH credentials

2. Edit the IP address & SSH config in Kamal `deploy.yml` file.
3. Test you SSH status with:

   ```sh
   kamal lock status
   ```

4. If the above returns a non-zero error code, run the below:

    ```sh
    eval `ssh-agent -s`
    ssh-add <path-to-your-key>.pem
    ```

5. Now test the SSH status again:

    ```sh
    kamal lock status
    ```

    This should now run successfully & exit with 0.

6. Generate a Classic Personal Access Token for `container:write` & `container:read` for your Image Registry (DockerHub, GHCR, etc.) & add it to your environment variables (.env file). Also update the Registry details in the `deploy.yml`.

7. If your SSH user is a non-root user, run the below command to add the user to the docker group:

    ```sh
    sudo usermod -aG docker ${USER}
    ```

    > Note: The above needs to be ran on the Cloud VM. There is an open Issue on Kamal for the same [here](https://github.com/basecamp/kamal/issues/405)

> Run the below for SSL config the first time
```sh
sudo mkdir -p /letsencrypt && sudo touch /letsencrypt/acme.json && sudo chmod 600 /letsencrypt/acme.json
```

8. Make sure you have docker buildx locally on your machine where you run the kamal CLI from!

9. Voila! You are all set to deploy your application to the cloud with Kamal! 🚀

    ```sh
    kamal setup -c kamal/deploy.yml
    ```

    This will setup the cloud VM with all the necessary tools & dependencies to run your application.

> Make sure to run `kamal env push` before a `kamal deploy` to push the latest environment variables to the cloud VM.

### Debugging for Kamal

- If you run into an error such as:

    ```sh
    failed to solve: cannot copy to non-directory:
    ```

    Then simply run `pnpm clean` & try again.

- Make sure your Database accepts connection from the cloud VM. You can do this by adding the VM's IP address to the `Allowed Hosts` in your Database settings.

- If you get an error such as:

    ```sh
    Lock failed: failed to acquire lock: lockfile already exists
    ```

    Then simply run `kamal lock release -c kamal/deploy.yml` & try again.

- If you run into:
    ```sh
    No config found
    ```

    Then simply add the following at the end of the command: `-c kamal/deploy.yml`

For further details, refer to the [Kamal Documentation](https://kamal-deploy.org/docs/configuration) or reach out to us on our [Discord](https://formbricks.com/discord)

# Rollback to a Previous Version

```sh
kamal rollback [git_commit_hash_to_rollback_to] -c kamal/deploy.yml
```

## View Formbricks Server logs with Kamal

```sh
kamal app logs -c kamal/deploy.yml
```

# Configure Memory Metrics on AWS using CW Agent

1. Install the CloudWatch Agent on the EC2 instance

```sh
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

2. Attach the IAM role of `CloudWatchFullAccessv2` to the EC2 instance

3. Edit the CloudWatch Agent config file

```sh
sudo nano /opt/aws/amazon-cloudwatch-agent/bin/config.json
```

4. Add the below config to the `config.json` file

```json
{
  "metrics": {
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      }
    },
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    }
  }
}
```

5. Fetch the config & start the CloudWatch Agent

```sh
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s
```

6. Now go to Cloudwatch > Metrics > All Metrics > Custom Namespaces > CWAgent > InstanceId > {InstanceId} > Tick the Checkbox next to it > Graph above will be updated
