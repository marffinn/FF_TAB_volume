#!/bin/bash

# Add your API key and secret here
# IMPORTANT: Replace YOUR_API_KEY and YOUR_API_SECRET with your actual credentials.
API_KEY="user:19142052:960"
API_SECRET="6a513583514ae961bab8394dcef2411c07bb70384c12b6e6891fb744cf726254"

# Get the current version from manifest.json
current_version=$(jq -r .version manifest.json)

# Increment the version
new_version=$(echo $current_version | awk -F. -v OFS=. '{$NF = $NF + 1;} 1')

# Update the version in manifest.json
jq ".version = \"$new_version\"" manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json

echo "Updated version to $new_version"

# Sign the extension
web-ext sign --api-key="$API_KEY" --api-secret="$API_SECRET" --channel listed

# Revert the version change in manifest.json
jq ".version = \"$current_version\"" manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json

echo "Reverted version to $current_version"
