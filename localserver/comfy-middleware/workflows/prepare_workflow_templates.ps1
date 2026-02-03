$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Output "[Tapnow] Scan workflows subfolders..."

Get-ChildItem -Directory | ForEach-Object {
    $dir = $_.FullName
    $jsons = Get-ChildItem -Path $dir -Filter *.json -File

    if ($jsons.Count -eq 1 -and $jsons[0].Name -ne "template.json") {
        $oldPath = $jsons[0].FullName
        $newPath = Join-Path $dir "template.json"
        Write-Output "[Rename] $($_.Name)\$($jsons[0].Name) -> template.json"
        Rename-Item -Path $oldPath -NewName "template.json"
    }

    $tplPath = Join-Path $dir "template.json"
    if (Test-Path $tplPath) {
        Write-Output "[Meta] Generating meta.json in $($_.Name)"
        $tpl = Get-Content $tplPath -Raw | ConvertFrom-Json
        $params = [ordered]@{}

        $tpl.PSObject.Properties | ForEach-Object {
            $nodeId = $_.Name
            $node = $_.Value
            if ($null -ne $node.inputs) {
                $node.inputs.PSObject.Properties | ForEach-Object {
                    $key = "$nodeId.$($_.Name)"
                    $params[$key] = [ordered]@{
                        node_id = $nodeId
                        field   = "inputs.$($_.Name)"
                    }
                }
            }
        }

        $meta = [ordered]@{
            name         = $_.Name
            params_map   = $params
            generated_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }

        $metaPath = Join-Path $dir "meta.json"
        $meta | ConvertTo-Json -Depth 6 | Set-Content -Path $metaPath -Encoding UTF8
    } else {
        Write-Output "[Skip] $($_.Name) (no template.json)"
    }
}

Write-Output "[Tapnow] Done."
