#!/bin/bash

images=($(yq eval '.services.*.image' packages/database/docker-compose.yml))

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