# E-Swap 2.2 AWS deployment

This package contains an AWS Academy-compatible serverless implementation of E-Swap 2.2. It keeps the original local mode for offline testing and activates AWS mode when the deployment script writes the production environment variables.

> **AWS Academy route:** use `MANUAL_DEPLOYMENT_US_EAST_1.md`. It creates Cognito manually, updates the existing Lambda/API and deploys the frontend through Amplify Hosting. The CloudFormation/CloudFront path below is optional and may be blocked by learner-account permissions.

## Architecture

| Layer | AWS service | Purpose |
|---|---|---|
| Web application | AWS Amplify Hosting | Delivers the manually uploaded Vite/React bundle over HTTPS |
| Authentication | Amazon Cognito user pool | Registration, email confirmation, password reset and signed tokens |
| HTTP API | Amazon API Gateway HTTP API | Validates Cognito JWTs and applies CORS/throttling |
| Application logic | AWS Lambda, Node.js 22 | Authorization, marketplace actions, escrow, moderation, messaging and recycling |
| Application state | Amazon DynamoDB | Durable server-side state with conditional version writes |
| Images | Amazon S3 | Five-minute presigned uploads for JPG, PNG and WebP files |
| Sign-in email alerts | Amazon SNS | Filtered email-only security notifications after Cognito authentication |
| Monitoring | Amazon CloudWatch | Lambda logs and API/Lambda operational visibility |
| Execution role | Existing AWS Academy `LabRole` | Avoids creating an IAM role blocked by the learner account |
| Infrastructure as code | AWS CloudFormation | Creates, updates and reports the complete stack |

## Security behaviour implemented

- Passwords and account verification are managed by Cognito; password material is not stored in DynamoDB.
- Cognito Post Confirmation requests one filtered SNS email subscription per confirmed user; no SMS or mobile-push channel is configured.
- Cognito Post Authentication publishes `E-Swap security alert: new sign-in` with a `recipientEmail` message attribute so each confirmed subscriber receives only their own alert.
- SNS subscription and publish failures are caught and logged instead of intentionally rejecting registration or login.
- API Gateway validates Cognito JWT issuer and audience before protected requests reach Lambda.
- Access and ID tokens expire after 60 minutes; the web client can use its seven-day refresh token.
- User API responses contain only that user's orders, wallet history, notifications and conversations.
- Public profile responses expose only trust information: name, avatar, location, bio, join date, completed trades, active listings and public reviews.
- Public profiles never expose email addresses, wallet history, orders, private messages or moderation records.
- Administrators receive the complete moderation view, including all conversations and audit records.
- Every protected mutation is authorized again inside Lambda.
- Escrow release/refund requires a reason and is logged with actor, order, users, amount, before/after status and time.
- DynamoDB conditional version writes prevent two concurrent requests from both processing the same escrow.
- Idempotency keys prevent a browser retry from repeating an already-accepted action.
- S3 upload URLs expire after five minutes and accept only JPG, PNG or WebP.
- Amplify Hosting publishes the frontend over HTTPS; production deployments should use its managed domain or a verified custom domain.

## Prerequisites

1. Start the AWS Academy learner lab.
2. Open **AWS Details** and reveal the CLI credentials.
3. Install AWS CLI v2 and Node.js 22 or later on the computer.
4. Paste the AWS Academy CLI environment-variable commands into a new PowerShell terminal.
5. Confirm the session:

```powershell
aws sts get-caller-identity
```

Do not paste the access key, secret key or session token into chat, source files or Git.

## Deploy

Open PowerShell in the extracted project root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\aws\deploy.ps1
```

The default region is US East (N. Virginia) (`us-east-1`) and the default stack name is `e-swap-2-2`.

To choose another allowed region:

```powershell
.\aws\deploy.ps1 -Region eu-west-2
```

The script:

1. validates the temporary AWS session;
2. installs and tests package dependencies;
3. packages the API, Cognito triggers and SNS email integration with the Lambda code;
4. uploads the deployment artifact to S3;
5. deploys the CloudFormation stack using `LabRole`;
6. reads the API, Cognito and CloudFront values from stack outputs;
7. builds the React frontend in AWS mode;
8. uploads the frontend to its private S3 origin;
9. invalidates the CloudFront cache;
10. checks the live `/health` endpoint; and
11. prints the final HTTPS website URL.

Production-style accounts use each person's own verified email. Public registration creates a standard user who can both buy and sell. Add a confirmed account to the Cognito `Admins` group to grant administrator access.

For manual Student Lab deployment, create the Standard SNS topic `e-swap-user-login-alerts`, set `LOGIN_ALERT_TOPIC_ARN` on Lambda, and attach the same function to Cognito's Post Confirmation and Post Authentication triggers. Each user must confirm the AWS SNS subscription email once before sign-in alerts can be delivered.

## Validate after deployment

```powershell
$HealthUrl = aws cloudformation describe-stacks `
  --stack-name e-swap-2-2 `
  --region us-east-1 `
  --query "Stacks[0].Outputs[?OutputKey=='HealthUrl'].OutputValue" `
  --output text

Invoke-RestMethod $HealthUrl
```

Expected status: `ok`.

Then complete the journeys in `TESTING_CHECKLIST.md`, especially:

- buyer order creation and held wallet balance;
- seller acceptance and ready-for-collection status;
- administrator release and refund with mandatory reasons;
- repeated escrow action being rejected;
- admin inspection of user profiles, listings, orders, wallets and messages;
- user and seller access to public member profiles, time on platform and reviewer comments;
- recycling submit → approve/reject → complete;
- S3 listing image upload;
- SNS email subscription confirmation followed by a filtered sign-in alert; and
- audit-log records for every administrator decision.

## AWS Academy troubleshooting

If CloudFormation fails, open:

**CloudFormation → Stacks → e-swap-2-2 → Events**

Copy the first red `CREATE_FAILED` reason. The first failure normally identifies the blocked service or permission.

Common lab limitations:

- **LabRole not found:** run `aws iam get-role --role-name LabRole`. If the lab uses another pre-created role, deploy with `-LabRoleName RoleName`.
- **CloudFront or Cognito AccessDenied:** the active Academy `LabRole` or learner policy does not permit the resource shown in the first failing event. Preserve the stack and record that exact event.
- **ExpiredToken:** restart the lab and paste the new CLI credentials. AWS Academy session credentials expire.
- **AccessDenied:** record the exact resource and action. Do not create broad IAM policies in a learner account.
- **SNS email does not arrive:** confirm the subscription is `Confirmed`, check the Cognito triggers, verify `LOGIN_ALERT_TOPIC_ARN`, then inspect CloudWatch for `subscription failed` or `publish failed`.
- **Stack rollback:** delete the failed stack after reading its events, refresh credentials and run the script again.

## Additional production hardening

This is a deployable university-lab build, not the final public production configuration. Before using real customer data:

- enable Cognito MFA or passkeys according to the application's risk model;
- attach a custom domain and ACM certificate to CloudFront;
- restrict CORS to the final frontend domain;
- place AWS WAF before the public application/API;
- replace `LabRole` with least-privilege Lambda and deployment roles;
- split the aggregate DynamoDB state into dedicated single-table entities and use `TransactWriteItems` for wallet/escrow operations;
- enable DynamoDB point-in-time recovery, S3 versioning and lifecycle rules;
- add automated API, integration, load and security tests; and
- remove any sample marketplace records before accepting real customer data.

## Remove the stack

```powershell
.\aws\destroy.ps1
```

The script empties the frontend bucket and deletes the stack. DynamoDB state and uploaded images are retained intentionally to prevent accidental data loss.
