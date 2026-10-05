# E-Swap 2.2 — Fresh Manual AWS Academy Deployment (`us-east-1`)

This guide rebuilds E-Swap 2.2 from zero in an AWS Academy Student Lab. It uses the existing `LabRole`, real Cognito email accounts and Amazon SNS email-only sign-in alerts. Do not create a new IAM role, SMS subscription, mobile-push application or demo Cognito user.

## Fixed names and values

```text
Region: us-east-1
DynamoDB table: e-swap-2-2-state
Lambda function: e-swap-2-2-api
HTTP API: e-swap-2-2-http-api
Cognito app client: e-swap-2-2-web
Cognito administrator group: Admins
SNS topic: e-swap-user-login-alerts
Amplify app: e-swap-2-2
Amplify branch: production
Lambda handler: src/handler.handler
```

Record these generated values during deployment:

```text
AWS account ID:
Image bucket:
Cognito user pool ID:
Cognito app client ID:
SNS topic ARN:
API URL:
Amplify URL:
```

## Account and role model

- Public registration always creates a standard `user`.
- Every standard user can both buy and sell.
- The Cognito `Admins` group grants the only administrator role.
- SNS is used only for user-specific email sign-in security alerts.
- Each email subscription is filtered by its `recipientEmail` message attribute.
- SNS errors are caught and logged so they do not intentionally reject Cognito registration or sign-in.

## 1. Start the lab

1. Start the AWS Academy learner lab.
2. Select **US East (N. Virginia) `us-east-1`**.
3. Confirm **IAM → Roles → LabRole** exists.
4. Do not create or modify an IAM role unless the instructor explicitly allows it.

## 2. Create DynamoDB

Create a DynamoDB table:

```text
Table name: e-swap-2-2-state
Partition key: PK
Partition key type: String
Sort key: none
Capacity: On-demand
Encryption: AWS owned key
```

Wait until its status is **Active**. Do not create an item manually.

## 3. Create the S3 image bucket

Create a globally unique bucket in `us-east-1`:

```text
e-swap-2-2-images-YOUR_ACCOUNT_ID-us-east-1
```

Use **Bucket owner enforced** object ownership. E-Swap currently returns public S3 URLs for uploaded images, so allow a narrowly scoped public-read policy only for `uploads/*`.

Set this CORS configuration, initially using `*` until the Amplify URL exists:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 300
  }
]
```

Use this bucket policy after replacing both instances of `BUCKET_NAME`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadUploadedImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/uploads/*"
    }
  ]
}
```

If the learner account blocks public bucket policies, record the exact error. Do not disable account-wide protections without instructor approval.

## 4. Create Cognito

In **Cognito → User pools**, create a pool with:

```text
Application type: Single-page application (SPA)
Application name/client name: e-swap-2-2-web
Sign-in identifier: Email
Self-registration: Enabled
Required attributes: email and name
Email verification: Verification code
Account recovery: Verified email
MFA: Off for this university build
Minimum password length: 8
Required characters: uppercase, lowercase, number and symbol
Email provider: Cognito
Client secret: Do not generate
Authentication flows: SRP, username/password and refresh token
Access token validity: 60 minutes
ID token validity: 60 minutes
Refresh token validity: 7 days
```

If the wizard requires a return URL, use `http://localhost:5173`. E-Swap uses its own login form rather than Cognito managed login.

Copy the **User pool ID** and **App client ID**. Then create the group:

```text
Admins
```

Do not create `.local` demo accounts in Cognito.

## 5. Create SNS for email-only sign-in alerts

In **Amazon SNS → Topics**, create:

```text
Type: Standard
Name: e-swap-user-login-alerts
Display name: E-Swap login alerts
```

Copy the topic ARN. Do not manually add a general email subscription and do not configure SMS. The Cognito Post Confirmation trigger requests one filtered SNS email subscription for each newly confirmed user.

## 6. Create Lambda with LabRole

In **Lambda → Create function**:

```text
Author from scratch
Function name: e-swap-2-2-api
Runtime: Node.js 22.x
Architecture: x86_64
Execution role: Use an existing role
Existing role: LabRole
```

After creation:

1. Upload `aws/backend/dist/e-swap-api-cognito.zip`.
2. Set handler to `src/handler.handler`.
3. Set memory to `512 MB`.
4. Set timeout to `30 seconds`.
5. Add these environment variables:

```text
TABLE_NAME = e-swap-2-2-state
IMAGE_BUCKET = your exact S3 image bucket name
USER_POOL_ID = your Cognito user pool ID
LOGIN_ALERT_TOPIC_ARN = your SNS topic ARN
ALLOWED_ORIGIN = *
```

The Student Lab `LabRole` must permit DynamoDB `GetItem`/`PutItem`, S3 `PutObject`, SNS `Publish`/`Subscribe`/`ListSubscriptionsByTopic`, and CloudWatch Logs. If an operation returns `AccessDenied`, copy the exact denied action; do not create a broad policy.

## 7. Initialise the DynamoDB state

In the Lambda function, open **Test**, create an event and use:

```json
{
  "operation": "INITIALISE_ESWAP_STATE"
}
```

Run the test once. Expected body:

```json
{
  "service": "e-swap-2.2-api",
  "status": "initialised",
  "storage": "dynamodb"
}
```

Running it again safely returns `already-initialised`. The seed stored in DynamoDB contains sample marketplace records but no password material and creates no demo Cognito identities.

## 8. Connect Cognito triggers

Open the Cognito user pool and add the same Lambda function to both triggers:

```text
Post confirmation trigger: e-swap-2-2-api
Post authentication trigger: e-swap-2-2-api
```

The console should add permission for Cognito to invoke the Lambda function. Confirm Lambda **Configuration → Permissions → Resource-based policy statements** includes `cognito-idp.amazonaws.com`.

Behaviour:

1. Post Confirmation requests an SNS `email` subscription for the confirmed Cognito email.
2. SNS sends its own subscription-confirmation email.
3. The user clicks **Confirm subscription** once.
4. Future successful Cognito sign-ins publish `E-Swap security alert: new sign-in` only to that email.

## 9. Test Lambda health directly

Create a second Lambda test event:

```json
{
  "version": "2.0",
  "routeKey": "GET /health",
  "rawPath": "/health",
  "requestContext": {
    "http": {
      "method": "GET",
      "path": "/health"
    }
  }
}
```

Expected response: status code `200` and body status `ok`.

## 10. Create API Gateway HTTP API

Create an **HTTP API**, not a REST API:

```text
API name: e-swap-2-2-http-api
Integration: Lambda e-swap-2-2-api
Payload format: 2.0
Stage: $default
Auto-deploy: Enabled
```

Create these routes and attach the Lambda integration:

```text
$default
GET /health
GET /public-state
OPTIONS /{proxy+}
```

Create a JWT authorizer:

```text
Name: e-swap-cognito-jwt
Identity source: $request.header.Authorization
Audience: your Cognito app client ID
Issuer: https://cognito-idp.us-east-1.amazonaws.com/YOUR_USER_POOL_ID
```

Attach the JWT authorizer only to `$default`. Keep `GET /health`, `GET /public-state` and `OPTIONS /{proxy+}` unauthenticated.

Configure CORS:

```text
Allowed origins: *
Allowed methods: GET, POST, OPTIONS
Allowed headers: authorization, content-type
Max age: 300
Allow credentials: off
```

Recommended `$default` stage throttling for the lab:

```text
Rate limit: 25 requests/second
Burst limit: 50 requests
```

Copy the API invoke URL without a trailing slash.

## 11. Test the API before building the frontend

```powershell
$ApiUrl = "PASTE_API_INVOKE_URL"
curl.exe -i "$ApiUrl/health"
curl.exe -i "$ApiUrl/public-state"
curl.exe -i "$ApiUrl/state"
```

Expected results:

```text
GET /health       → 200 OK
GET /public-state → 200 OK
GET /state        → 401 Unauthorized without a JWT
```

## 12. Build the AWS-connected frontend

Open PowerShell in the package's `frontend` folder:

```powershell
@"
VITE_API_URL=PASTE_API_INVOKE_URL
VITE_STORAGE_MODE=aws
VITE_COGNITO_USER_POOL_ID=PASTE_USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=PASTE_APP_CLIENT_ID
"@ | Set-Content -Encoding utf8 .env.production

npm.cmd ci
npm.cmd test
npm.cmd run build
Compress-Archive -Path .\dist\* -DestinationPath .\e-swap-2-2-amplify.zip -Force
```

The ZIP must contain `index.html` at its root. Do not deploy an older prebuilt frontend because it contains the previous account's API and Cognito identifiers.

## 13. Deploy Amplify Hosting

1. Open **Amplify → Create new app → Deploy without Git**.
2. App name: `e-swap-2-2`.
3. Branch: `production`.
4. Method: **Drag and drop**.
5. Upload `frontend/e-swap-2-2-amplify.zip`.
6. Choose **Save and deploy**.

Add this SPA rewrite under **Hosting → Rewrites and redirects**:

```text
Source: /<*>
Target: /index.html
Type: 200 (Rewrite)
```

Copy the final Amplify URL.

## 14. Restrict CORS to Amplify

Replace the temporary `*` with the exact Amplify origin, without a trailing slash, in:

1. Lambda `ALLOWED_ORIGIN`.
2. API Gateway CORS allowed origins.
3. S3 bucket CORS allowed origins.

Redeploy the API stage if auto-deploy is not enabled, then refresh the application.

## 15. Register users and confirm SNS email

For each real user:

1. Register through E-Swap with an accessible email.
2. Enter the Cognito verification code.
3. Open the separate AWS SNS subscription-confirmation email.
4. Click **Confirm subscription** once.
5. Log out and sign in again.
6. Confirm an email with subject `E-Swap security alert: new sign-in` arrives.

The automatic sign-in immediately after registration can occur before the SNS subscription is confirmed. Test the sign-in alert after confirming the subscription and signing in again.

## 16. Promote the administrator

1. Register and confirm the administrator's real email through E-Swap.
2. Confirm its SNS email subscription.
3. Add the confirmed Cognito user to the `Admins` group.
4. Log out and sign in again to refresh the ID token.
5. Confirm the administrator dashboard opens.

## 17. CloudWatch and WAF

Open Lambda **Monitor → View CloudWatch logs** and verify these messages as applicable:

```text
E-Swap login alert subscription requested
E-Swap login alert published
```

Failures are logged as:

```text
E-Swap login alert subscription failed
E-Swap login alert publish failed
```

After Amplify is stable, open **Amplify → Hosting → Firewall** and attempt the recommended AWS WAF protection. AWS Academy may block WAF creation; record any exact `AccessDenied` message rather than changing `LabRole`.

## 18. Final validation

- Two real users can register, verify email, sign in, buy and sell.
- Each confirmed SNS email subscription receives only its own sign-in alerts.
- No SMS or mobile-push subscription exists.
- An ordinary user cannot access `/admin`.
- A Cognito `Admins` group member can access the administrator dashboard.
- Listing image upload works through a five-minute S3 presigned PUT URL.
- Escrow release/refund requires a reason and cannot be processed twice.
- Messaging, profiles, reviews, recycling, audit logs and administrator inspection work.

Use `TESTING_CHECKLIST.md` for the complete functional validation.
