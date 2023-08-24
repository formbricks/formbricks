FROM gitpod/workspace-full

# Install custom tools, runtime, etc.
RUN brew install yq 

RUN pnpm install turbo --global