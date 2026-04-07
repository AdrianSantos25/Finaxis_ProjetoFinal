param(
  [string]$OutputDir = "data/backups",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "gestor_financeiro" }
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$dbPass = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }

$file = Join-Path $OutputDir ("{0}-{1}.sql" -f $dbName, $timestamp)

function Get-MysqlDumpPath {
  if ($env:MYSQLDUMP_PATH -and (Test-Path $env:MYSQLDUMP_PATH)) {
    return $env:MYSQLDUMP_PATH
  }

  $cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $commonPaths = @(
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
    'C:\Program Files\MySQL\MySQL Server 8.1\bin\mysqldump.exe',
    'C:\Program Files\MySQL\MySQL Server 8.2\bin\mysqldump.exe',
    'C:\xampp\mysql\bin\mysqldump.exe',
    'C:\wamp64\bin\mysql\mysql8.0.\bin\mysqldump.exe'
  )

  foreach ($path in $commonPaths) {
    if (Test-Path $path) {
      return $path
    }
  }

  return $null
}

$mysqldumpPath = Get-MysqlDumpPath
if (-not $mysqldumpPath) {
  throw "mysqldump não encontrado. Defina MYSQLDUMP_PATH ou adicione-o ao PATH."
}

if ($dbPass) {
  $env:MYSQL_PWD = $dbPass
}

& $mysqldumpPath -h $dbHost -P $dbPort -u $dbUser --single-transaction --routines --triggers $dbName > $file

if ($dbPass) {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Host "Backup criado em: $file"

if ($RetentionDays -gt 0) {
  $limite = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -Path $OutputDir -Filter "*.sql" -File |
    Where-Object { $_.LastWriteTime -lt $limite } |
    Remove-Item -Force -ErrorAction SilentlyContinue
}
