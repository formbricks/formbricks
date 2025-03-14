#!/bin/bash

images=($(yq eval '.services.*.image' docker-compose.dev.yml))

pull_image() {
  docker pull "$1"
}

# install packages in background
pnpm i &

# pull images
for image in "${images[@]}"
do
  pull_image "$image" &
done

wait