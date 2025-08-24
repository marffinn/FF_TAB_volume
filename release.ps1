# release.ps1
# PowerShell script to build, version, and sign the web extension.

# --- PRE-FLIGHT CHECKS ---
# Ensure critical commands are available
$jq_exists = (Get-Command jq -ErrorAction SilentlyContinue)
$webext_exists = (Get-Command web-ext -ErrorAction SilentlyContinue)

if (-not $jq_exists) {
    Write-Host "Error: 'jq' command not found. Please install it and ensure it's in your PATH."
    exit 1
}
if (-not $webext_exists) {
    Write-Host "Error: 'web-ext' command not found. Please run 'npm install --global web-ext' and ensure it's in your PATH."
    exit 1
}

# --- SCRIPT LOGIC ---

$current_version = jq -r .version manifest.json
$tempFile = "tmp.$([System.Guid]::NewGuid()).json"

# Wrap the core logic in a try...finally block to ensure the version is reverted.
try {
    # Load environment variables from .env file
    if (Test-Path .\.env) {
        Write-Host "Loading environment variables from .env file..."
        Get-Content .\.env | ForEach-Object {
            $line = $_.Trim()
            if ($line -and !$line.StartsWith("#")) {
                $name, $value = $line.Split('=', 2)
                # Set environment variable for the current process
                [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
            }
        }
    }

    # Increment the version
    $versionParts = $current_version.Split('.')
    $lastPart = [int]$versionParts[-1] + 1
    $versionParts[-1] = $lastPart.ToString()
    $new_version = $versionParts -join '.'

    # Update the version in manifest.json for packaging
    jq --arg newver "$new_version" '.version = $newver' manifest.json > $tempFile
    Move-Item -Path $tempFile -Destination "manifest.json" -Force
    Write-Host "Temporarily updated version to $new_version for signing."

    # Sign the extension
    Write-Host "Signing the extension..."
    web-ext sign --api-key="$($env:API_KEY)" --api-secret="$($env:API_SECRET)" --channel listed

} finally {
    # This block will run even if errors occur.
    # Revert the version change in manifest.json to keep the source file clean.
    Write-Host "Reverting version change in manifest.json..."
    jq --arg curver "$current_version" '.version = $curver' manifest.json > $tempFile
    Move-Item -Path $tempFile -Destination "manifest.json" -Force
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Write-Host "Reverted version to $current_version. Script finished."
}
