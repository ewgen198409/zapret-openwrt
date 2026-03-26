#!/bin/bash
# Generate releases JSON for zapret-openwrt gh-pages

set -e

REPO_OWNER="ewgen198409"
REPO_NAME="zapret-openwrt"
RELEASE_TAG="${1:-}"

if [ -z "$RELEASE_TAG" ]; then
    echo "Usage: $0 <release_tag>"
    exit 1
fi

# Create output directory
OUTPUT_DIR="releases"
mkdir -p "$OUTPUT_DIR"

# Initialize JSON structure
cat > "$OUTPUT_DIR/releases_template.json" << 'EOF'
{
  "generated_at": "GENERATED_AT_PLACEHOLDER",
  "releases": {
    "release_0": {
      "tag": "TAG_PLACEHOLDER",
      "prerelease": PRERELEASE_PLACEHOLDER,
      "assets": [
        {
          "name": "asset_name",
          "browser_download_url": "https://github.com/OWNER/REPO/releases/download/TAG/asset_name"
        }
      ]
    }
  }
}
EOF

# Get release info from GitHub API
API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}"

# Fetch release data
RELEASE_DATA=$(curl -s "${API_URL}")

if echo "$RELEASE_DATA" | grep -q '"message"'; then
    echo "Error: Release ${RELEASE_TAG} not found"
    exit 1
fi

# Extract release info
IS_PRERELEASE=$(echo "$RELEASE_DATA" | grep -o '"prerelease":[^,}]*' | cut -d':' -f2 | tr -d ' ' | head -1)
CREATED_AT=$(echo "$RELEASE_DATA" | grep -o '"created_at":"[^"]*"' | cut -d'"' -f4 | head -1)

# Get architectures from assets
ARCHS=$(echo "$RELEASE_DATA" | grep -o '"name":"[^"]*ipk"' | cut -d'"' -f4 | sed 's/.*_//g' | sed 's/.ipk//g' | sort -u)

echo "Release: $RELEASE_TAG"
echo "Prerelease: $IS_PRERELEASE"
echo "Created: $CREATED_AT"
echo "Architectures: $ARCHS"

# Generate JSON files for each architecture
for ARCH in $ARCHS; do
    OUTPUT_FILE="${OUTPUT_DIR}/releases_${ARCH}.json"
    
    # Generate JSON
    cat > "$OUTPUT_FILE" << JSONEOF
{
  "generated_at": "$CREATED_AT",
  "releases": {
    "0": {
      "tag": "$RELEASE_TAG",
      "prerelease": $IS_PRERELEASE,
      "assets": [
        {
          "name": "zapret_*_${ARCH}.ipk",
          "browser_download_url": "https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/zapret_*_${ARCH}.ipk"
        },
        {
          "name": "luci-app-zapret_*_all.ipk",
          "browser_download_url": "https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/luci-app-zapret_*_all.ipk"
        }
      ]
    }
  }
}
JSONEOF
    
    echo "Generated: $OUTPUT_FILE"
done

echo "Done!"
