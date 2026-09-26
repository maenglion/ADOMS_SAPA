# ADOMS 400 (포트 3400) 운영 모드로 열기 — 2026-09-24
#  · 운영 모드 = 미리 빌드한 화면으로 띄운다(개발용 오류 알림 없음 · 화면 전환이 빠름)
#  · 빌드 결과는 .next-prod 에 따로 둔다(개발 서버 .next 와 부딪히지 않게 — next.config.ts distDir)
#  · 코드가 빌드보다 새로우면 다시 빌드 · 데이터 판(_CURRENT.json)이 바뀌었으면 서버만 다시 켠다
#  · 이미 최신 운영 서버가 떠 있으면 브라우저만 연다
param([switch]$NoBrowser)   # 작업자가 다시 빌드만 할 때(브라우저를 열지 않음)
$ErrorActionPreference = "Continue"
$port = 3400
$app  = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = ".next-prod"
$url  = "http://localhost:$port/"
$mark = Join-Path $app ".prod-400.json"
$data = Join-Path $app "..\..\..\..\30_데이터\_수집작업\ADOMS_DB_v1\_데모_용인시_20260920\_CURRENT.json"
$host.UI.RawUI.WindowTitle = "ADOMS 400 열기"

function Say($m) { Write-Host ("  " + $m) }
function PortPid { $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($c) { ($c | Select-Object -First 1).OwningProcess } else { $null } }
function Stamp($p) { if (Test-Path $p) { (Get-Item $p).LastWriteTime } else { [datetime]::MinValue } }

# 코드의 가장 늦은 수정 시각(빌드가 필요한지)
$src = @("app", "components", "lib", "public") | ForEach-Object { Join-Path $app $_ } | Where-Object { Test-Path $_ }
$newest = (Get-ChildItem $src -Recurse -File -ErrorAction SilentlyContinue | Measure-Object LastWriteTime -Maximum).Maximum
foreach ($f in "next.config.ts", "package.json") { $t = Stamp (Join-Path $app $f); if ($t -gt $newest) { $newest = $t } }
$built = Stamp (Join-Path $app "$dist\BUILD_ID")
$needBuild = $newest -gt $built

# 지금 떠 있는 서버가 이 스크립트가 켠 최신 운영 서버인가
$pid0 = PortPid
$m = $null; if (Test-Path $mark) { try { $m = Get-Content $mark -Raw | ConvertFrom-Json } catch {} }
$isProd = $pid0 -and $m -and ($m.pid -eq $pid0)
$dataNewer = $m -and ((Stamp $data) -gt [datetime]$m.started)

if ($isProd -and -not $needBuild -and -not $dataNewer) {
  Say "운영 서버가 이미 떠 있습니다 — 브라우저를 엽니다."
  if (-not $NoBrowser) { Start-Process $url }
  Start-Sleep -Seconds 1
  exit 0
}

Write-Host ""
Say "ADOMS 400 — 운영 모드로 준비합니다. 이 창은 준비가 끝나면 저절로 닫힙니다."
Write-Host ""

# 3400 에 떠 있는 서버(개발 서버 포함)를 끈다
if ($pid0) {
  Say "포트 3400 의 서버를 끕니다(PID $pid0)."
  taskkill /PID $pid0 /T /F | Out-Null
  for ($i = 0; $i -lt 20 -and (PortPid); $i++) { Start-Sleep -Milliseconds 500 }
}

$env:NEXT_DIST_DIR = $dist
Set-Location $app
if ($needBuild) {
  Say "화면을 새로 빌드합니다(2~5분)..."
  Write-Host ""
  & cmd.exe /c "npx next build 2>&1" | Tee-Object -FilePath (Join-Path $app ".build-400.log")
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $app "$dist\BUILD_ID"))) {
    Write-Host ""
    Say "빌드가 실패했습니다. 기록: .build-400.log"
    Read-Host "  Enter 를 누르면 닫습니다"
    exit 1
  }
}

Say "운영 서버를 켭니다..."
$log = Join-Path $app ".prod-400.log"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "set NEXT_DIST_DIR=$dist&& npx next start -p $port -H 0.0.0.0 > `"$log`" 2>&1" -WorkingDirectory $app -WindowStyle Hidden
$pid1 = $null
for ($i = 0; $i -lt 90; $i++) { Start-Sleep -Seconds 1; $pid1 = PortPid; if ($pid1) { break } }
if (-not $pid1) {
  Say "서버가 켜지지 않았습니다. 기록: .prod-400.log"
  Read-Host "  Enter 를 누르면 닫습니다"
  exit 1
}
@{ pid = $pid1; started = (Get-Date).ToString("s"); dist = $dist } | ConvertTo-Json | Set-Content $mark -Encoding UTF8
try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 60 | Out-Null } catch {}
Say "준비 끝 — 브라우저를 엽니다."
if (-not $NoBrowser) { Start-Process $url }
Start-Sleep -Seconds 2
