# Applies the algo-bots migration to a THROWAWAY postgres container (twice, to prove idempotency) and runs
# verify_migration.sql. Uses minimal stubs for public.tenants / public.users (the FK targets); it does NOT apply the
# whole Prisma history. Never touches any other container.
param([string]$Image = "postgres:16-alpine")
$ErrorActionPreference = "Continue"
$name = "tradex-mig-verify"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$mig = Join-Path $root "backend\prisma\migrations\20261114100000_algo_trading_bots\migration.sql"
$chk = Join-Path $PSScriptRoot "verify_migration.sql"
docker rm -f $name *> $null
docker run -d --name $name -e POSTGRES_PASSWORD=verify $Image | Out-Null
try {
  for ($i = 0; $i -lt 60; $i++) {
    docker exec $name pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Start-Sleep -Seconds 2; break }
    Start-Sleep -Seconds 1
  }
  docker exec $name psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.tenants(id TEXT PRIMARY KEY); CREATE TABLE public.users(id TEXT PRIMARY KEY);' | Out-Null
  foreach ($pass in 1, 2) {
    Write-Host "== applying migration (pass $pass) =="
    Get-Content -Raw $mig | docker exec -i $name psql -U postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "migration failed on pass $pass" }
  }
  Write-Host "== running checks =="
  Get-Content -Raw $chk | docker exec -i $name psql -U postgres -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw "verification failed" }
  docker exec $name psql -U postgres -t -c "select count(*) || ' tables in schema algo' from information_schema.tables where table_schema='algo'"
} finally {
  docker rm -f $name *> $null
}
