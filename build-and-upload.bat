@echo off
setlocal enabledelayedexpansion

echo Building Firefox Extension...

REM Read current version from manifest.json
for /f "tokens=2 delims=:" %%a in ('findstr "version" manifest.json') do (
    set version_line=%%a
    set version_line=!version_line: =!
    set version_line=!version_line:"=!
    set version_line=!version_line:,=!
    set current_version=!version_line!
)

echo Current version: %current_version%

REM Parse version parts
for /f "tokens=1,2 delims=." %%a in ("%current_version%") do (
    set major=%%a
    set minor=%%b
)

REM Increment minor version
set /a minor+=1
set new_version=%major%.%minor%

echo New version: %new_version%

REM Update manifest.json
powershell -Command "(Get-Content manifest.json) -replace '\"version\": \"%current_version%\"', '\"version\": \"%new_version%\"' | Set-Content manifest.json"

REM Create package
set package_name=volume-for-tabs-v%new_version%.zip
echo Creating package: %package_name%

powershell -Command "Compress-Archive -Path 'background.js','content.js','popup.css','popup.html','popup.js','manifest.json','icon.png','LICENSE' -DestinationPath '%package_name%' -Force"

echo Package created successfully!

REM Upload to Mozilla (requires web-ext and API credentials)
echo Uploading to Mozilla Add-ons...
if exist ".env" (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="AMO_JWT_ISSUER" set AMO_JWT_ISSUER=%%b
        if "%%a"=="AMO_JWT_SECRET" set AMO_JWT_SECRET=%%b
    )
    
    if defined AMO_JWT_ISSUER if defined AMO_JWT_SECRET (
        npx web-ext sign --api-key="%AMO_JWT_ISSUER%" --api-secret="%AMO_JWT_SECRET%" --channel=listed
        echo Upload completed!
    ) else (
        echo Error: AMO credentials not found in .env file
        echo Please create .env file with:
        echo AMO_JWT_ISSUER=your_issuer_key
        echo AMO_JWT_SECRET=your_secret_key
    )
) else (
    echo .env file not found. Creating template...
    echo AMO_JWT_ISSUER=your_issuer_key > .env
    echo AMO_JWT_SECRET=your_secret_key >> .env
    echo Please edit .env file with your Mozilla API credentials
)

pause