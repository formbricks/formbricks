#!/bin/bash

# Base URL for the API
BASE_URL="https://queue.formbricks.com/api/v1/client/clssrjim3000ao4uz5aal74kn/responses"

# Content-Type header
CONTENT_TYPE="Content-Type: application/json"

# Incremental number, assuming this script is called with an argument for the number
INCREMENTAL_NUMBER=$1

# Survey response data with the incremental number
DATA_RAW="{
  \"surveyId\": \"clssrqluj0000v5kf975pmznb\",
  \"finished\": true,
  \"data\": {
      \"weqyag4iooty2scmgmv73emp\": \"clicked\",
      \"hi25scsa33uryr8cxt9pes0y\":\"Not at all disappointed\",
      \"a77c7sn0pbbfwxiv89ao0a96\":\"Founder\",
      \"w2rya77cbb774ci6luvs47bh\":\"Script Testing $INCREMENTAL_NUMBER\",
      \"jesbp8kf2c93xlis6drkhzmg\":\"Shubham is a legend\",
      \"mrdnptdqumaljwpbikl2vgo3\":\"Formbricks is legendary $INCREMENTAL_NUMBER\"
    }
}"

# Sending the request
response=$(curl -s -w "%{http_code}" -o /dev/null --location --request POST "$BASE_URL" --header "$CONTENT_TYPE" --header "$COUNTRY" --header "$FORWARDED" --data-raw "$DATA_RAW")
