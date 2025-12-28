param(
  [string]$Url = "http://127.0.0.1:8000/webhooks/cal",
  [string]$Secret = $env:CAL_WEBHOOK_SECRET,
  [string]$Email = "test@example.com",
  [string]$Event = "booking.completed"
)

$payload = @{
  event   = $Event
  booking = @{
    attendees = @(
      @{ email = $Email }
    )
  }
} | ConvertTo-Json -Depth 6

$headers = @{
  "Content-Type"     = "application/json"
}

if ($Secret) {
  $secretBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $hmac = New-Object System.Security.Cryptography.HMACSHA256($secretBytes)
  $hash = $hmac.ComputeHash($bodyBytes)
  $signature = ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
  $headers["X-Cal-Signature"] = $signature
} else {
  Write-Host "CAL_WEBHOOK_SECRET not set; sending unsigned payload."
}

Write-Host "POST $Url"
Write-Host "Event: $Event"
Write-Host "Email: $Email"

Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $payload
