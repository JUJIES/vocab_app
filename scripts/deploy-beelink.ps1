[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{7,40}$')]
  [string]$Commit,

  [switch]$Activate,

  [ValidateRange(6100, 6199)]
  [int]$CandidatePort = 6100
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$DevPath = 'C:\Users\Julius Herrmann\Coding Projects\_dev\Lerndeck'
$ReleaseRoot = 'C:\Users\Julius Herrmann\Coding Projects\_services\Lerndeck'
$RuntimeRoot = 'C:\Users\Julius Herrmann\Coding Projects\_runtime\Lerndeck'
$DataPath = Join-Path $RuntimeRoot 'data'
$ServiceName = 'BeelinkApp-Lerndeck'
$ServiceConfig = 'C:\ProgramData\Beelink\Services\lerndeck\service-6000.xml'
$PublicBaseUrl = 'https://lerndeck.jujies.app'
$ImportModel = 'gpt-5.6-terra'

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Set-ServiceEnvironmentValue {
  param(
    [Parameter(Mandatory = $true)][xml]$Document,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $node = @($Document.service.env) | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $node) {
    $node = $Document.CreateElement('env')
    $node.SetAttribute('name', $Name)
    $node.SetAttribute('value', $Value)
    [void]$Document.service.AppendChild($node)
    return
  }

  $node.SetAttribute('value', $Value)
}

function Get-ServiceEnvironmentValue {
  param(
    [Parameter(Mandatory = $true)][xml]$Document,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $node = @($Document.service.env) | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $node) {
    return $null
  }
  return [string]$node.value
}

function Wait-ForHealth {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [int]$Attempts = 30
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri $Uri -TimeoutSec 3
      if ($response.status -eq 'ok') {
        return $response
      }
    } catch {
      if ($attempt -eq $Attempts) {
        throw
      }
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Healthcheck did not become ready: $Uri"
}

if (-not (Test-Path -LiteralPath $DevPath)) {
  throw "Development clone not found: $DevPath"
}
if (-not (Test-Path -LiteralPath $ServiceConfig)) {
  throw "Service configuration not found: $ServiceConfig"
}

Write-Host 'Fetching the reviewed commit from origin...'
Invoke-Native -FilePath 'git.exe' -Arguments @('fetch', '--prune', 'origin') -WorkingDirectory $DevPath

$FullCommit = (& git.exe -C $DevPath rev-parse --verify "$Commit^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or $FullCommit -notmatch '^[0-9a-f]{40}$') {
  throw "Commit cannot be resolved: $Commit"
}

& git.exe -C $DevPath merge-base --is-ancestor $FullCommit 'origin/main'
if ($LASTEXITCODE -ne 0) {
  throw "Commit is not contained in origin/main: $FullCommit"
}

$ShortCommit = $FullCommit.Substring(0, 7)
$ReleasePath = Join-Path $ReleaseRoot $ShortCommit
$Origin = (& git.exe -C $DevPath remote get-url origin).Trim()

if (Test-Path -LiteralPath $ReleasePath) {
  $ExistingCommit = (& git.exe -C $ReleasePath rev-parse HEAD).Trim()
  $ExistingChanges = @(& git.exe -C $ReleasePath status --porcelain=v1)
  if ($ExistingCommit -ne $FullCommit -or $ExistingChanges.Count -gt 0) {
    throw "Existing release directory is not the expected immutable release: $ReleasePath"
  }
  Write-Host "Using existing clean release $ShortCommit."
} else {
  Write-Host "Creating immutable release $ShortCommit..."
  Invoke-Native -FilePath 'git.exe' -Arguments @('clone', '--no-checkout', $Origin, $ReleasePath) -WorkingDirectory $ReleaseRoot
  Invoke-Native -FilePath 'git.exe' -Arguments @('checkout', '--detach', $FullCommit) -WorkingDirectory $ReleasePath
}

Write-Host 'Installing production dependencies and running release gates...'
Invoke-Native -FilePath 'npm.cmd' -Arguments @('ci', '--omit=dev') -WorkingDirectory $ReleasePath
Invoke-Native -FilePath 'npm.cmd' -Arguments @('run', 'verify') -WorkingDirectory $ReleasePath
Invoke-Native -FilePath 'npm.cmd' -Arguments @('audit', '--omit=dev') -WorkingDirectory $ReleasePath

$CandidateRoot = Join-Path $RuntimeRoot 'preflight'
$CandidateData = Join-Path $CandidateRoot "$ShortCommit-data"
$CandidateLogs = Join-Path $CandidateRoot "$ShortCommit-logs"
New-Item -ItemType Directory -Path $CandidateData -Force | Out-Null
New-Item -ItemType Directory -Path $CandidateLogs -Force | Out-Null

$PreviousEnvironment = @{
  HOST = $env:HOST
  PORT = $env:PORT
  DATA_DIR = $env:DATA_DIR
  PUBLIC_BASE_URL = $env:PUBLIC_BASE_URL
  OPENAI_IMPORT_MODEL = $env:OPENAI_IMPORT_MODEL
  TEACHER_PIN = $env:TEACHER_PIN
}

$CandidateProcess = $null
try {
  $env:HOST = '127.0.0.1'
  $env:PORT = [string]$CandidatePort
  $env:DATA_DIR = $CandidateData
  $env:PUBLIC_BASE_URL = "http://127.0.0.1:$CandidatePort"
  $env:OPENAI_IMPORT_MODEL = $ImportModel
  $env:TEACHER_PIN = 'candidate-only'

  $CandidateProcess = Start-Process -FilePath 'node.exe' -ArgumentList @('server.js') `
    -WorkingDirectory $ReleasePath -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $CandidateLogs 'stdout.log') `
    -RedirectStandardError (Join-Path $CandidateLogs 'stderr.log')
  [void](Wait-ForHealth -Uri "http://127.0.0.1:$CandidatePort/health")
  Write-Host "Candidate healthcheck passed on port $CandidatePort."
} finally {
  if ($null -ne $CandidateProcess -and -not $CandidateProcess.HasExited) {
    Stop-Process -Id $CandidateProcess.Id -Force
    $CandidateProcess.WaitForExit()
  }
  foreach ($name in $PreviousEnvironment.Keys) {
    Set-Item -LiteralPath "Env:$name" -Value $PreviousEnvironment[$name]
  }
}

if (-not $Activate) {
  Write-Host "Prepared release $FullCommit at $ReleasePath."
  Write-Host 'The active service was not changed. Re-run with -Activate after approval.'
  exit 0
}

[xml]$ServiceXml = Get-Content -LiteralPath $ServiceConfig -Raw
$OpenAiApiKey = Get-ServiceEnvironmentValue -Document $ServiceXml -Name 'OPENAI_API_KEY'
if ([string]::IsNullOrWhiteSpace($OpenAiApiKey)) {
  throw 'OPENAI_API_KEY is not configured. Pipe the key through set-beelink-openai-key.ps1 before activation.'
}

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $RuntimeRoot 'backups'
$DataBackup = Join-Path $BackupRoot "$Timestamp-before-$ShortCommit"
New-Item -ItemType Directory -Path $DataBackup -Force | Out-Null
Copy-Item -Path (Join-Path $DataPath '*') -Destination $DataBackup -Recurse -Force

$ServiceBackup = "$ServiceConfig.before-$ShortCommit-$Timestamp"
Copy-Item -LiteralPath $ServiceConfig -Destination $ServiceBackup
$PreviousWorkingDirectory = [string]$ServiceXml.service.workingdirectory

Set-ServiceEnvironmentValue -Document $ServiceXml -Name 'PUBLIC_BASE_URL' -Value $PublicBaseUrl
Set-ServiceEnvironmentValue -Document $ServiceXml -Name 'OPENAI_IMPORT_MODEL' -Value $ImportModel
$ServiceXml.service.workingdirectory.InnerText = [string]$ReleasePath

Write-Host 'Provisioning the predefined teacher accounts...'
Invoke-Native -FilePath 'node.exe' -Arguments @('scripts/provision-teachers.js', "--data-dir=$DataPath") -WorkingDirectory $ReleasePath

$ServiceXml.Save($ServiceConfig)
try {
  Restart-Service -Name $ServiceName -Force
  [void](Wait-ForHealth -Uri 'http://127.0.0.1:6000/health' -Attempts 40)
  Write-Host "Activated release $FullCommit."
  Write-Host "Runtime backup: $DataBackup"
  Write-Host "Service backup: $ServiceBackup"
} catch {
  Write-Error "Activation failed; restoring previous release $PreviousWorkingDirectory."
  Copy-Item -LiteralPath $ServiceBackup -Destination $ServiceConfig -Force
  Restart-Service -Name $ServiceName -Force
  [void](Wait-ForHealth -Uri 'http://127.0.0.1:6000/health' -Attempts 40)
  throw
}
