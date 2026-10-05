param(
  [string]$Region = "us-east-1",
  [string]$StackName = "e-swap-2-2",
  [string]$LabRoleName = "LabRole"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $PSScriptRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$BuildRoot = Join-Path $PSScriptRoot ".build"
$SecretFile = Join-Path $BuildRoot "auth-secret.txt"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found in PATH."
  }
}

Require-Command "aws"
Require-Command "node"
Require-Command "npm.cmd"

New-Item -ItemType Directory -Path $BuildRoot -Force | Out-Null

Write-Host "Checking the AWS Academy session..." -ForegroundColor Cyan
$Identity = aws sts get-caller-identity --region $Region --output json | ConvertFrom-Json
if (-not $Identity.Account) {
  throw "No active AWS session was found. Start the AWS Academy lab and paste its CLI credentials into this terminal."
}

$AccountId = $Identity.Account
$LabRoleArn = "arn:aws:iam::${AccountId}:role/${LabRoleName}"
$ArtifactBucket = ("$StackName-artifacts-$AccountId-$Region").ToLower()

Write-Host "Building the Lambda package..." -ForegroundColor Cyan
Push-Location $BackendRoot
try {
  npm.cmd ci
  npm.cmd test
  npm.cmd run build:seed
} finally {
  Pop-Location
}

$LambdaStage = Join-Path $BuildRoot "lambda"
$LambdaZip = Join-Path $BuildRoot "e-swap-api-cognito.zip"
Remove-Item $LambdaStage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $LambdaZip -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $LambdaStage -Force | Out-Null
Copy-Item (Join-Path $BackendRoot "src") $LambdaStage -Recurse
Copy-Item (Join-Path $BackendRoot "node_modules") $LambdaStage -Recurse
Copy-Item (Join-Path $BackendRoot "package.json") $LambdaStage
Compress-Archive -Path (Join-Path $LambdaStage "*") -DestinationPath $LambdaZip -CompressionLevel Optimal
$PackageHash = (Get-FileHash $LambdaZip -Algorithm SHA256).Hash.ToLower()
$CodeKey = "lambda/e-swap-api-cognito-$PackageHash.zip"

Write-Host "Preparing the deployment bucket..." -ForegroundColor Cyan
aws s3api head-bucket --bucket $ArtifactBucket 2>$null
if ($LASTEXITCODE -ne 0) {
  if ($Region -eq "us-east-1") {
    aws s3api create-bucket --bucket $ArtifactBucket --region $Region | Out-Null
  } else {
    aws s3api create-bucket --bucket $ArtifactBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
  }
}
aws s3 cp $LambdaZip "s3://$ArtifactBucket/$CodeKey" --region $Region --only-show-errors

if (-not (Test-Path $SecretFile)) {
  $Bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
  [Convert]::ToBase64String($Bytes) | Set-Content -Path $SecretFile -NoNewline
}
$AuthSecret = Get-Content $SecretFile -Raw

Write-Host "Deploying CloudFormation stack $StackName..." -ForegroundColor Cyan
aws cloudformation deploy `
  --template-file (Join-Path $PSScriptRoot "infrastructure.yaml") `
  --stack-name $StackName `
  --region $Region `
  --no-fail-on-empty-changeset `
  --parameter-overrides `
    "CodeBucket=$ArtifactBucket" `
    "CodeKey=$CodeKey" `
    "LabRoleArn=$LabRoleArn" `
    "AuthSecret=$AuthSecret" `
    "AllowedOrigin=*" `
  --tags Project=E-Swap-2.2

if ($LASTEXITCODE -ne 0) {
  throw "CloudFormation deployment failed. Open the stack Events tab and copy the first CREATE_FAILED reason."
}

$Outputs = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output json | ConvertFrom-Json

function Output([string]$Key) {
  return ($Outputs | Where-Object OutputKey -eq $Key).OutputValue
}

$ApiUrl = Output "ApiUrl"
$FrontendBucket = Output "FrontendBucketName"
$FrontendUrl = Output "FrontendUrl"
$HealthUrl = Output "HealthUrl"
$CognitoUserPoolId = Output "CognitoUserPoolId"
$CognitoUserPoolClientId = Output "CognitoUserPoolClientId"
$ApiFunctionArn = Output "ApiFunctionArn"
$LoginAlertTopicArn = Output "LoginAlertTopicArn"
$CloudFrontDistributionId = Output "CloudFrontDistributionId"

Write-Host "Connecting Cognito confirmation and authentication triggers..." -ForegroundColor Cyan
aws cognito-idp update-user-pool `
  --user-pool-id $CognitoUserPoolId `
  --lambda-config "PostConfirmation=$ApiFunctionArn,PostAuthentication=$ApiFunctionArn" `
  --region $Region | Out-Null

Write-Host "Building the AWS-connected frontend..." -ForegroundColor Cyan
@"
VITE_API_URL=$ApiUrl
VITE_STORAGE_MODE=aws
VITE_COGNITO_USER_POOL_ID=$CognitoUserPoolId
VITE_COGNITO_USER_POOL_CLIENT_ID=$CognitoUserPoolClientId
"@ | Set-Content -Path (Join-Path $FrontendRoot ".env.production")

Push-Location $FrontendRoot
try {
  npm.cmd ci
  npm.cmd test
  npm.cmd run build
} finally {
  Pop-Location
}

Write-Host "Uploading the frontend..." -ForegroundColor Cyan
aws s3 sync (Join-Path $FrontendRoot "dist") "s3://$FrontendBucket" --delete --region $Region --only-show-errors
aws cloudfront create-invalidation --distribution-id $CloudFrontDistributionId --paths "/*" | Out-Null

$Health = Invoke-RestMethod -Uri $HealthUrl -Method Get
if ($Health.status -ne "ok") {
  throw "The stack deployed, but the API health check is not ready."
}

Write-Host ""
Write-Host "E-Swap 2.2 is live." -ForegroundColor Green
Write-Host "Frontend: $FrontendUrl"
Write-Host "API:      $ApiUrl"
Write-Host "Region:   $Region"
Write-Host "SNS:      $LoginAlertTopicArn"
Write-Host ""
Write-Host "Register real email accounts through E-Swap and confirm each SNS email subscription." -ForegroundColor Yellow
Write-Host "Grant administrator access by adding a confirmed account to the Cognito Admins group." -ForegroundColor Yellow
Write-Host "CloudFront can take several minutes to finish deploying globally." -ForegroundColor Yellow
