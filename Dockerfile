# Use a base image
FROM alpine:latest

# Set the working directory
WORKDIR /app

# Create a simple script to echo "Hello, World!"
RUN echo "#!/bin/sh\n\
echo 'Hello, World!'" > script.sh

# Give execute permissions to the script
RUN chmod +x script.sh

# Run the script when the container starts
CMD ["./script.sh"]
