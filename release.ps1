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

# Create a temporary directory for backups
$backupDir = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $backupDir | Out-Null
Write-Host "Backup directory created at $backupDir"

# Wrap the core logic in a try...finally block to ensure cleanup
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

    # Find all JavaScript files, excluding node_modules
    $jsFiles = Get-ChildItem -Path . -Recurse -Filter *.js -Exclude "*node_modules*"

    # Backup and "minify" JavaScript files
    foreach ($file in $jsFiles) {
        Write-Host "Processing $($file.FullName)..."
        # 1. Backup original file
        Copy-Item -Path $file.FullName -Destination $backupDir

        # 2. Read content and remove comments/console.logs (replicating original script's logic)
        $content = Get-Content $file.FullName -Raw
        $modifiedContent = ($content -split [System.Environment]::NewLine) |
            Where-Object { $_ -notmatch '//' -and $_ -notmatch 'console\.log' } |
            ForEach-Object { $_ -replace '/\*.*?\*/', '' }
        
        # 3. Write modified content back to the file
        Set-Content -Path $file.FullName -Value ($modifiedContent -join [System.Environment]::NewLine)
    }

    # Get the current version from manifest.json
    $current_version = jq -r .version manifest.json

    # Increment the version
    $versionParts = $current_version.Split('.')
    $lastPart = [int]$versionParts[-1] + 1
    $versionParts[-1] = $lastPart.ToString()
    $new_version = $versionParts -join '.'

    # Update the version in manifest.json
    $tempFile = "tmp.$([System.Guid]::NewGuid()).json"
    jq --arg newver "$new_version" '.version = $newver' manifest.json > $tempFile
    Move-Item -Path $tempFile -Destination "manifest.json" -Force
    Write-Host "Updated version to $new_version"

    # Sign the extension
    Write-Host "Signing the extension..."
    web-ext sign --api-key="$($env:API_KEY)" --api-secret="$($env:API_SECRET)" --channel listed

    # Revert the version change in manifest.json
    jq --arg curver "$current_version" '.version = $curver' manifest.json > $tempFile
    Move-Item -Path $tempFile -Destination "manifest.json" -Force
    Write-Host "Reverted version to $current_version"

} finally {
    # This block will run even if errors occur, ensuring files are restored.

    # Restore original JavaScript files
    $jsFiles = Get-ChildItem -Path . -Recurse -Filter *.js -Exclude "*node_modules*"
    foreach ($file in $jsFiles) {
        $backupFile = Join-Path $backupDir $file.Name
        if (Test-Path $backupFile) {
            Write-Host "Restoring $($file.FullName)..."
            Copy-Item -Path $backupFile -Destination $file.FullName -Force
        }
    }

    # Clean up the backup directory
    Write-Host "Cleaning up backup directory..."
    Remove-Item -Recurse -Force -Path $backupDir
}

Write-Host "Script finished."