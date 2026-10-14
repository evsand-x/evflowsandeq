[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$blueprint = Join-Path $repoRoot 'docs\erp-blueprint'
$errors = [System.Collections.Generic.List[string]]::new()

$requiredPaths = @(
  'AGENTS.md',
  'docs\development\ai-agent-guide.md',
  'docs\erp-blueprint\00-document-map.md',
  'docs\erp-blueprint\02-requirements.md',
  'docs\erp-blueprint\31-audit-konsistensi.md',
  'docs\erp-blueprint\39-baseline-parameter-bisnis.md',
  'docs\erp-blueprint\40-kebijakan-operasional-konfigurasi.md',
  '.codex\skills\disflow-erp-builder\SKILL.md',
  'apps\office', 'apps\field', 'apps\api', 'apps\worker',
  'packages\backend', 'packages\database', 'packages\contracts',
  'packages\design-tokens', 'packages\ui-react', 'packages\ui-vue', 'packages\config'
)

foreach ($relativePath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
    $errors.Add("Required path is missing: $relativePath")
  }
}

$skillPath = Join-Path $repoRoot '.codex\skills\disflow-erp-builder\SKILL.md'
if (Test-Path -LiteralPath $skillPath) {
  $skillContent = Get-Content -LiteralPath $skillPath -Raw
  $frontmatterMatch = [regex]::Match($skillContent, '(?s)^---\r?\n(?<frontmatter>.*?)\r?\n---')
  if (-not $frontmatterMatch.Success) {
    $errors.Add('Skill has invalid or missing YAML frontmatter delimiters.')
  } else {
    $frontmatter = $frontmatterMatch.Groups['frontmatter'].Value
    $nameMatch = [regex]::Match($frontmatter, '(?m)^name:\s*([^\r\n]+)\r?$')
    $descriptionMatch = [regex]::Match($frontmatter, '(?m)^description:\s*([^\r\n]+)\r?$')
    if (-not $nameMatch.Success) {
      $errors.Add('Skill frontmatter is missing name.')
    } elseif ($nameMatch.Groups[1].Value.Trim() -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' -or $nameMatch.Groups[1].Value.Trim().Length -gt 64) {
      $errors.Add('Skill name must be hyphen-case and no longer than 64 characters.')
    } elseif ($nameMatch.Groups[1].Value.Trim() -ne 'evflow-erp-builder') {
      $errors.Add('Project Skill name must be evflow-erp-builder.')
    }
    if (-not $descriptionMatch.Success) {
      $errors.Add('Skill frontmatter is missing description.')
    } elseif ($descriptionMatch.Groups[1].Value.Trim().Length -gt 1024 -or $descriptionMatch.Groups[1].Value -match '[<>]') {
      $errors.Add('Skill description is invalid.')
    }
    $topLevelKeys = @(
      $frontmatter -split '\r?\n' |
        Where-Object { $_ -match '^[A-Za-z][A-Za-z0-9-]*:' } |
        ForEach-Object { ($_ -split ':', 2)[0] }
    )
    $unexpectedKeys = @($topLevelKeys | Where-Object { $_ -notin @('name', 'description', 'license', 'allowed-tools', 'metadata') })
    foreach ($key in $unexpectedKeys) { $errors.Add("Unexpected Skill frontmatter key: $key") }
  }
  if ($skillContent -match '(?m)^\s*\[TODO:[^\]]*\]\s*$') {
    $errors.Add('Skill contains an unfinished TODO placeholder.')
  }
}

$markdownFiles = @(Get-ChildItem -LiteralPath $blueprint -Filter '*.md')
$missingLinks = [System.Collections.Generic.List[string]]::new()
$badTables = [System.Collections.Generic.List[string]]::new()

foreach ($file in $markdownFiles) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\(([^)]+)\)')) {
    $target = $match.Groups[1].Value
    if ($target -notmatch '^(https?://|#|mailto:|codex:)') {
      $cleanTarget = ($target -split '#')[0]
      if ($cleanTarget -and -not (Test-Path -LiteralPath (Join-Path $file.DirectoryName $cleanTarget))) {
        $missingLinks.Add("$($file.Name): $target")
      }
    }
  }

  $lines = Get-Content -LiteralPath $file.FullName
  $inTable = $false
  $expectedPipes = 0
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match '^\|') {
      $pipeCount = ([regex]::Matches($lines[$index], '(?<!\\)\|')).Count
      if (-not $inTable) {
        $inTable = $true
        $expectedPipes = $pipeCount
      } elseif ($pipeCount -ne $expectedPipes) {
        $badTables.Add("$($file.Name):$($index + 1) has $pipeCount pipes; expected $expectedPipes")
      }
    } else {
      $inTable = $false
      $expectedPipes = 0
    }
  }
}

$requirementIds = @(
  rg -o '\| [A-Z]{2,5}-[0-9]{2}' (Join-Path $blueprint '02-requirements.md') |
    ForEach-Object { ($_ -split '\| ')[1] }
)
$duplicateRequirements = @($requirementIds | Group-Object | Where-Object Count -gt 1)

$decisionIds = @(
  rg -o '^\| D[0-9]{2} ' (Join-Path $blueprint 'README.md') |
    ForEach-Object { ($_ -replace '^\| ', '').Trim() }
)
$duplicateDecisions = @($decisionIds | Group-Object | Where-Object Count -gt 1)

$conflictMarkers = @(rg -l '^(<<<<<<<|=======|>>>>>>>)' $repoRoot 2>$null)
$staleMarkers = @(
  rg -n -i 'keputusan terbuka|keputusan yang masih diperlukan|hal yang masih terbuka|baseline tersedia; perlu|kandidat kemasan native|framework final.*belum|provider/lokasi belum|interval/retensi.*belum|target produksi dikonfirmasi|durasi/retensi final belum' $blueprint -g '*.md' 2>$null
)
$targetedTypos = @(rg -n 'triwuIanan|massa manfaat|Capacitor kandidat|kandidat Capacitor' $blueprint -g '*.md' 2>$null)
$legacyProductNames = @(
  rg -n -i --hidden 'Disflow ERP|Sandeq ERP|\$disflow-erp-builder|disflow-(local|private|exports|minio-data)' $repoRoot -g '!**/.git/**' -g '!tools/validate-repository.ps1' 2>$null
)

foreach ($item in $missingLinks) { $errors.Add("Broken Markdown link: $item") }
foreach ($item in $badTables) { $errors.Add("Malformed Markdown table: $item") }
foreach ($item in $duplicateRequirements) { $errors.Add("Duplicate requirement ID: $($item.Name)") }
foreach ($item in $duplicateDecisions) { $errors.Add("Duplicate decision ID: $($item.Name)") }
foreach ($item in $conflictMarkers) { $errors.Add("Conflict marker: $item") }
foreach ($item in $staleMarkers) { $errors.Add("Stale finalization marker: $item") }
foreach ($item in $targetedTypos) { $errors.Add("Targeted typo: $item") }
foreach ($item in $legacyProductNames) { $errors.Add("Legacy product name: $item") }

Write-Host "Blueprint documents: $($markdownFiles.Count)"
Write-Host "Broken local links: $($missingLinks.Count)"
Write-Host "Duplicate requirement IDs: $($duplicateRequirements.Count)"
Write-Host "Duplicate decision IDs: $($duplicateDecisions.Count)"
Write-Host "Conflict markers: $($conflictMarkers.Count)"
Write-Host "Malformed Markdown tables: $($badTables.Count)"
Write-Host "Stale finalization markers: $($staleMarkers.Count)"
Write-Host "Targeted typos: $($targetedTypos.Count)"
Write-Host "Legacy product names: $($legacyProductNames.Count)"

if ($errors.Count -gt 0) {
  Write-Error ($errors -join [Environment]::NewLine)
  exit 1
}

Write-Host 'Repository validation passed.' -ForegroundColor Green
