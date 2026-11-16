# Publishes this repo to GitHub Pages and prints the public URL.
# Needs GitHub CLI once:  gh auth login --hostname github.com --git-protocol https --web
#
#   .\publish.ps1
#
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$login = gh api user --jq .login 2>$null
if (-not $login) { throw 'gh is not logged in. Run: gh auth login --hostname github.com --git-protocol https --web' }
Write-Host "account: $login"

$slug = 'ms9001fa-teardown'
$repo = "$login/$slug"
$url = "https://$($login.ToLower()).github.io/$slug"

# 1. the remote repo
gh repo view $repo --json name 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "creating $repo (public)"
  gh repo create $repo --public --source . --remote origin --push --description 'Interactive 3D teardown of the GE MS9001FA (PG9351FA) gas turbine - one offline HTML page you can take apart'
} else {
  if (-not (git remote get-url origin 2>$null)) { git remote add origin "https://github.com/$repo.git" }
  git push -u origin main
}

# 2. point the Open Graph tags at the real URL, then rebuild and push if it moved
$want = '{"url":"' + $url + '"}'
$cur = Get-Content site.json -Raw
if ($cur.Trim() -ne $want) {
  Set-Content site.json $want -NoNewline
  $old = ($cur | ConvertFrom-Json).url
  if ($old) { (Get-Content README.md -Raw).Replace($old, $url) | Set-Content README.md -NoNewline }
  node build.mjs | Out-Null
  git add -A
  git commit -q -m "Point the site at $url"
  git push origin main
}

# 3. Pages: serve main / root, no CI
try {
  gh api --method POST "repos/$repo/pages" -f 'source[branch]=main' -f 'source[path]=/' | Out-Null
  Write-Host 'pages: created'
} catch {
  Write-Host 'pages: already enabled'
}

# 4. wait for the first build
$status = 'pending'
for ($i = 0; $i -lt 45; $i++) {
  $status = gh api "repos/$repo/pages/builds/latest" --jq .status 2>$null
  if ($status -eq 'built') { break }
  Start-Sleep -Seconds 4
}
Write-Host "build: $status"
Write-Host "repo: https://github.com/$repo"
Write-Host "site: $url/"
