param(
  [string]$Region = "eu-west-2",
  [string]$StackName = "e-swap-2-2"
)

$ErrorActionPreference = "Stop"
$Outputs = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output json | ConvertFrom-Json

function Output([string]$Key) {
  return ($Outputs | Where-Object OutputKey -eq $Key).OutputValue
}

$FrontendBucket = Output "FrontendBucketName"
if ($FrontendBucket) {
  aws s3 rm "s3://$FrontendBucket" --recursive --region $Region --only-show-errors
}

aws cloudformation delete-stack --stack-name $StackName --region $Region
aws cloudformation wait stack-delete-complete --stack-name $StackName --region $Region

Write-Host "Stack deleted. The DynamoDB state table and image bucket were retained to protect data." -ForegroundColor Yellow
