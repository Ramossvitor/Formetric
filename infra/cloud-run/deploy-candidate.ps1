[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ProjectId,
    [Parameter(Mandatory)] [string] $ImageRef,
    [string] $Region = "southamerica-east1",
    [string] $ServiceName = "formetric",
    [Parameter(Mandatory)] [string] $RuntimeServiceAccount,
    [Parameter(Mandatory)] [string] $DbPoolerUrlSecret,
    [Parameter(Mandatory)] [string] $DbDirectUrlSecret,
    [Parameter(Mandatory)] [string] $DbUsernameSecret,
    [Parameter(Mandatory)] [string] $DbPasswordSecret,
    [Parameter(Mandatory)] [string] $SecretVersion,
    [switch] $ConfirmInitialBaseline,
    [switch] $BootstrapOwner,
    [string] $BootstrapAdminEmailSecret,
    [string] $BootstrapAdminPasswordSecret,
    [string] $BootstrapAdminDisplayNameSecret,
    [string] $BootstrapSecretVersion,
    [string] $CandidateTag = "candidate"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($ImageRef -notmatch '@sha256:[a-f0-9]{64}$') {
    throw "ImageRef must be immutable and include an @sha256 digest."
}
if ($SecretVersion -notmatch '^[1-9][0-9]*$') {
    throw "SecretVersion must be a pinned positive numeric version, never latest."
}
if (-not $ConfirmInitialBaseline) {
    throw "This script is only for the initial Flyway baseline. Pass -ConfirmInitialBaseline after reading migrations-and-rollback.md."
}
if ($BootstrapOwner) {
    $bootstrapValues = @(
        $BootstrapAdminEmailSecret,
        $BootstrapAdminPasswordSecret,
        $BootstrapAdminDisplayNameSecret,
        $BootstrapSecretVersion
    )
    if ($bootstrapValues.Where({ [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
        throw "BootstrapOwner requires the e-mail, password and display-name secret resources plus BootstrapSecretVersion."
    }
    if ($BootstrapSecretVersion -notmatch '^[1-9][0-9]*$') {
        throw "BootstrapSecretVersion must be a pinned positive numeric version, never latest."
    }
}

$secretBindings = @(
    "DB_POOLER_URL=${DbPoolerUrlSecret}:$SecretVersion"
    "DB_DIRECT_URL=${DbDirectUrlSecret}:$SecretVersion"
    "DB_USERNAME=${DbUsernameSecret}:$SecretVersion"
    "DB_PASSWORD=${DbPasswordSecret}:$SecretVersion"
) -join ','

$bootstrapSecretArguments = @(
    "--remove-secrets",
    "BOOTSTRAP_ADMIN_EMAIL,BOOTSTRAP_ADMIN_PASSWORD,BOOTSTRAP_ADMIN_DISPLAY_NAME"
)
if ($BootstrapOwner) {
    $secretBindings += ",BOOTSTRAP_ADMIN_EMAIL=${BootstrapAdminEmailSecret}:$BootstrapSecretVersion"
    $secretBindings += ",BOOTSTRAP_ADMIN_PASSWORD=${BootstrapAdminPasswordSecret}:$BootstrapSecretVersion"
    $secretBindings += ",BOOTSTRAP_ADMIN_DISPLAY_NAME=${BootstrapAdminDisplayNameSecret}:$BootstrapSecretVersion"
    $bootstrapSecretArguments = @()
}

$deployArguments = @(
    "run", "deploy", $ServiceName,
    "--project", $ProjectId,
    "--region", $Region,
    "--image", $ImageRef,
    "--service-account", $RuntimeServiceAccount,
    "--execution-environment", "gen2",
    "--port", "8080",
    "--cpu", "1",
    "--memory", "1Gi",
    "--concurrency", "20",
    "--timeout", "60",
    "--min-instances", "0",
    "--max-instances", "1",
    "--cpu-boost",
    "--ingress", "all",
    "--update-env-vars", "SPRING_PROFILES_ACTIVE=prod,JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=65 -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8",
    "--update-secrets", $secretBindings,
    "--startup-probe", "httpGet.path=/actuator/health/readiness,httpGet.port=8080,initialDelaySeconds=0,timeoutSeconds=3,periodSeconds=5,failureThreshold=48",
    "--liveness-probe", "httpGet.path=/actuator/health/liveness,httpGet.port=8080,initialDelaySeconds=10,timeoutSeconds=3,periodSeconds=30,failureThreshold=3",
    "--tag", $CandidateTag,
    "--no-traffic",
    "--quiet"
)
$deployArguments += $bootstrapSecretArguments

& gcloud @deployArguments
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run candidate deployment failed."
}

$serviceJson = & gcloud run services describe $ServiceName --project $ProjectId --region $Region --format json
if ($LASTEXITCODE -ne 0) {
    throw "Could not describe the deployed Cloud Run service."
}

$service = $serviceJson | ConvertFrom-Json
$candidate = $service.status.traffic | Where-Object { $_.tag -eq $CandidateTag } | Select-Object -First 1
if ($null -eq $candidate -or [string]::IsNullOrWhiteSpace([string] $candidate.url)) {
    throw "Cloud Run did not expose the '$CandidateTag' tagged revision URL."
}

$identityToken = (& gcloud auth print-identity-token "--audiences=$($service.status.url)").Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identityToken)) {
    throw "gcloud could not mint an identity token for the canonical Cloud Run service URL."
}
$requestHeaders = @{ Authorization = "Bearer $identityToken" }

$deadline = [DateTimeOffset]::UtcNow.AddMinutes(4)
do {
    try {
        $response = Invoke-WebRequest -Headers $requestHeaders -Uri "$($candidate.url)/actuator/health/readiness" -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Output "Candidate ready at $($candidate.url)"
            return
        }
    }
    catch {
        Write-Verbose $_.Exception.Message
    }
    Start-Sleep -Seconds 2
} while ([DateTimeOffset]::UtcNow -lt $deadline)

throw "Candidate did not become ready before the four-minute Cloud Run startup deadline."
