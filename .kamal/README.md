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

6. Generate an Access Token for your Image Registry (DockerHub, GHCR, etc.) & add it to your environment variables (.env file). Also update the Registry details in the `deploy.yml`.

7. If your SSH user is a non-root user, run the below command to add the user to the docker group:

    ```sh
    sudo usermod -aG docker ${USER}
    ```

    > Note: The above needs to be ran on the Cloud VM. There is an open Issue on Kamal for the same [here](https://github.com/basecamp/kamal/issues/405)

8. Make sure you have docker buildx locally on your machine where you run the kamal CLI from!

9. Voila! You are all set to deploy your application to the cloud with Kamal! 🚀

    ```sh
    kamal setup
    ```

    This will setup the cloud VM with all the necessary tools & dependencies to run your application.

## Debugging

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

    Then simply run `kamal lock release` & try again.

For further details, refer to the [Kamal Documentation](https://kamal-deploy.org/docs/configuration) or reach out to us on our [Discord](https://formbricks.com/discord)