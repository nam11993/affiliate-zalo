$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8765
$Prefix = "http://127.0.0.1:$Port/"

function Test-ShopeeHost([string]$hostName) {
    if ([string]::IsNullOrWhiteSpace($hostName)) { return $false }
    $h = $hostName.ToLowerInvariant().TrimEnd('.')
    return ($h -eq 'shopee.vn' -or
            $h -eq 'www.shopee.vn' -or
            $h -eq 's.shopee.vn' -or
            $h -eq 'vn.shp.ee' -or
            $h -eq 'shp.ee' -or
            $h -eq 'shopee.page.link' -or
            $h.EndsWith('.shopee.vn'))
}

function Get-ShopeeLinkType([string]$urlText) {
    try { $u = [Uri]$urlText } catch { return 'OTHER' }
    $urlHost = $u.Host.ToLowerInvariant()
    $path = [Uri]::UnescapeDataString($u.AbsolutePath).ToLowerInvariant()

    if ($urlHost -eq 'sv.shopee.vn' -or $path.Contains('/share-video/') -or $path.Contains('/video/')) { return 'VIDEO' }
    if ($urlHost -eq 'live.shopee.vn' -or $path.Contains('/live/') -or $u.Query -match '(^|[?&])type=live(?:&|$)') { return 'LIVE' }
    if ($path -match '/product/\d+/\d+' -or $path -match '-i\.\d+\.\d+(?:/|$)') { return 'PRODUCT' }
    if ($urlHost -eq 'vn.shp.ee' -or $urlHost -eq 'shp.ee' -or $urlHost -eq 's.shopee.vn' -or $urlHost -eq 'shopee.page.link') { return 'SHORT' }
    return 'OTHER'
}

function Find-ShopeeUrlInHtml([string]$html, [string]$currentUrl) {
    if ([string]::IsNullOrWhiteSpace($html)) { return $null }
    $normalized = $html.Replace('\/','/').Replace('&amp;','&')

    # Prefer explicit Shopee Video / Live / Product URLs if a bridge page embeds them.
    $patterns = @(
        'https?://sv\.shopee\.vn/[^"''<>\s]+',
        'https?://live\.shopee\.vn/[^"''<>\s]+',
        'https?://(?:www\.)?shopee\.vn/[^"''<>\s]+'
    )

    foreach ($pattern in $patterns) {
        $m = [regex]::Match($normalized, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($m.Success) {
            $candidate = $m.Value
            try {
                $uri = [Uri]$candidate
                if ((Test-ShopeeHost $uri.Host) -and $candidate -ne $currentUrl) { return $candidate }
            } catch {}
        }
    }

    # Common HTML/JS redirect forms.
    $genericPatterns = @(
        'url\s*=\s*["'']?([^"'';>\s]+)',
        '(?:window\.)?location(?:\.href)?\s*=\s*["'']([^"'']+)["'']',
        'location\.replace\(\s*["'']([^"'']+)["'']\s*\)',
        '<link[^>]+rel=["'']canonical["''][^>]+href=["'']([^"'']+)["'']',
        '<meta[^>]+property=["'']og:url["''][^>]+content=["'']([^"'']+)["'']'
    )
    foreach ($pattern in $genericPatterns) {
        $m = [regex]::Match($normalized, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($m.Success) {
            $candidate = $m.Groups[1].Value
            try {
                $base = [Uri]$currentUrl
                $uri = New-Object System.Uri($base, $candidate)
                if ((Test-ShopeeHost $uri.Host) -and $uri.AbsoluteUri -ne $currentUrl) { return $uri.AbsoluteUri }
            } catch {}
        }
    }
    return $null
}

function Resolve-ShopeeShortLink([string]$urlText) {
    try { $inputUri = [Uri]$urlText } catch { throw 'URL không hợp lệ.' }
    if (-not (Test-ShopeeHost $inputUri.Host)) { throw "Không hỗ trợ domain: $($inputUri.Host)" }

    $directType = Get-ShopeeLinkType $urlText
    if ($directType -ne 'SHORT') {
        return [ordered]@{
            originalUrl = $urlText
            resolvedUrl = $urlText
            directType = $directType
            linkType = $directType
            wasShort = $false
            source = 'DIRECT'
        }
    }

    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $true
    $handler.MaxAutomaticRedirections = 10
    $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    $client.DefaultRequestHeaders.TryAddWithoutValidation('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36') | Out-Null
    $client.DefaultRequestHeaders.TryAddWithoutValidation('Accept', 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8') | Out-Null
    $client.DefaultRequestHeaders.TryAddWithoutValidation('Accept-Language', 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7') | Out-Null

    try {
        $response = $client.GetAsync($inputUri).GetAwaiter().GetResult()
        $finalUrl = $response.RequestMessage.RequestUri.AbsoluteUri
        $finalType = Get-ShopeeLinkType $finalUrl
        $source = 'HTTP_REDIRECT'

        # Some short links can end at an HTML bridge page rather than a plain 30x redirect.
        if ($finalType -eq 'SHORT' -or $finalType -eq 'OTHER') {
            $html = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $embedded = Find-ShopeeUrlInHtml $html $finalUrl
            if ($embedded) {
                $embeddedType = Get-ShopeeLinkType $embedded
                if ($embeddedType -ne 'SHORT' -and $embeddedType -ne 'OTHER') {
                    $finalUrl = $embedded
                    $finalType = $embeddedType
                    $source = 'HTML_BRIDGE'
                }
            }
        }

        return [ordered]@{
            originalUrl = $urlText
            resolvedUrl = $finalUrl
            directType = 'SHORT'
            linkType = $finalType
            wasShort = $true
            source = $source
            httpStatus = [int]$response.StatusCode
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Write-Bytes($response, [byte[]]$bytes, [string]$contentType, [int]$status = 200) {
    $response.StatusCode = $status
    $response.ContentType = $contentType
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

function Write-Json($response, $obj, [int]$status = 200) {
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    Write-Bytes $response $bytes 'application/json; charset=utf-8' $status
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)
try {
    $listener.Start()
} catch {
    Write-Host ''
    Write-Host 'Khong the mo local test server.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Thu dong cac chuong trinh dang dung port 8765 roi chay lai.' -ForegroundColor Yellow
    Read-Host 'Nhan Enter de dong'
    exit 1
}

Write-Host "Shopee short-link test server: $Prefix" -ForegroundColor Green
Write-Host 'Dan SHORT LINK vao o Tin nhan. He thong se tu resolve va phan loai PRODUCT / VIDEO / LIVE.' -ForegroundColor Cyan
Write-Host 'Khong can npm / Node.js.' -ForegroundColor Cyan
Start-Process $Prefix

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        try {
            $path = $ctx.Request.Url.AbsolutePath
            if ($path -eq '/' -or $path -eq '/SIMULATOR_STANDALONE.html') {
                $file = Join-Path $Root 'SIMULATOR_STANDALONE.html'
                $bytes = [IO.File]::ReadAllBytes($file)
                Write-Bytes $ctx.Response $bytes 'text/html; charset=utf-8'
                continue
            }
            if ($path -eq '/api/resolve') {
                $requestUrl = $ctx.Request.QueryString['url']
                if ([string]::IsNullOrWhiteSpace($requestUrl)) {
                    Write-Json $ctx.Response @{ ok = $false; error = 'Thieu query url.' } 400
                    continue
                }
                try {
                    $data = Resolve-ShopeeShortLink $requestUrl
                    Write-Json $ctx.Response @{ ok = $true; data = $data } 200
                } catch {
                    Write-Json $ctx.Response @{ ok = $false; error = $_.Exception.Message } 400
                }
                continue
            }
            Write-Json $ctx.Response @{ ok = $false; error = 'Not found' } 404
        } catch {
            try { Write-Json $ctx.Response @{ ok = $false; error = $_.Exception.Message } 500 } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
