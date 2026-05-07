param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"

function Write-JsonResult {
  param([hashtable]$Value)
  $Value | ConvertTo-Json -Compress
}

function Get-ClipboardImage {
  try {
    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
      return [System.Windows.Forms.Clipboard]::GetImage()
    }
  } catch {
    return $null
  }
  return $null
}

function Get-ImagePngBytes {
  param($Image)
  $stream = New-Object System.IO.MemoryStream
  try {
    $Image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally {
    $stream.Dispose()
  }
}

function Get-ImageHash {
  param($Image)
  $bytes = Get-ImagePngBytes -Image $Image
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash($bytes)
    return [System.BitConverter]::ToString($hashBytes)
  } finally {
    $sha.Dispose()
  }
}

try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $baselineHash = $null
  $baselineImage = Get-ClipboardImage
  if ($null -ne $baselineImage) {
    try {
      $baselineHash = Get-ImageHash -Image $baselineImage
    } finally {
      $baselineImage.Dispose()
    }
  }

  try {
    Start-Process "ms-screenclip:"
  } catch {
    Start-Process "SnippingTool.exe" -ArgumentList "/clip"
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  Start-Sleep -Milliseconds 800

  while ((Get-Date) -lt $deadline) {
    $image = Get-ClipboardImage
    if ($null -ne $image) {
      try {
        $hash = Get-ImageHash -Image $image
        if ($null -eq $baselineHash -or $hash -ne $baselineHash) {
          $bytes = Get-ImagePngBytes -Image $image
          $directory = Split-Path -Parent $OutputPath
          if ($directory) {
            New-Item -ItemType Directory -Force -Path $directory | Out-Null
          }
          [System.IO.File]::WriteAllBytes($OutputPath, $bytes)
          Write-JsonResult @{
            ok = $true
            path = $OutputPath
            name = ("windows-snip-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".png")
            size = $bytes.Length
          }
          exit 0
        }
      } finally {
        $image.Dispose()
      }
    }
    Start-Sleep -Milliseconds 400
  }

  Write-JsonResult @{ ok = $false; error = "截图已取消或超时" }
  exit 2
} catch {
  Write-JsonResult @{ ok = $false; error = $_.Exception.Message }
  exit 1
}
