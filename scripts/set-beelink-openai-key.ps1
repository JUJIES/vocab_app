[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ServiceConfig = 'C:\ProgramData\Beelink\Services\lerndeck\service-6000.xml'
$PublicBaseUrl = 'https://lerndeck.jujies.app'
$ImportModel = 'gpt-5.6-terra'

if (-not (Test-Path -LiteralPath $ServiceConfig)) {
  throw "Service configuration not found: $ServiceConfig"
}

$ApiKey = [Console]::In.ReadToEnd().Trim()
if ($ApiKey -notmatch '^sk-[A-Za-z0-9_-]{20,}$') {
  throw 'Standard input does not contain a plausible OpenAI API key.'
}

[xml]$Document = Get-Content -LiteralPath $ServiceConfig -Raw
foreach ($entry in @(
  @{ Name = 'PUBLIC_BASE_URL'; Value = $PublicBaseUrl },
  @{ Name = 'OPENAI_IMPORT_MODEL'; Value = $ImportModel },
  @{ Name = 'OPENAI_API_KEY'; Value = $ApiKey }
)) {
  $node = @($Document.service.env) | Where-Object { $_.name -eq $entry.Name } | Select-Object -First 1
  if ($null -eq $node) {
    $node = $Document.CreateElement('env')
    $node.SetAttribute('name', $entry.Name)
    [void]$Document.service.AppendChild($node)
  }
  $node.SetAttribute('value', $entry.Value)
}

$TemporaryPath = "$ServiceConfig.next"
$Document.Save($TemporaryPath)
Move-Item -LiteralPath $TemporaryPath -Destination $ServiceConfig -Force

Write-Host 'OpenAI import configuration stored in the protected service configuration.'
Write-Host 'The running service was not restarted.'
