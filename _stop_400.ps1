# ADOMS 400 (port 3400) stop - kills only the process listening on port 3400
$c = Get-NetTCPConnection -LocalPort 3400 -State Listen -ErrorAction SilentlyContinue
if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /PID $_ /T /F | Out-Null } }
