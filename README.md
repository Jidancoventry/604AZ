# E-Swap 2.2 — Local Test and AWS-Ready Version

E-Swap 2.2 can run as the original browser-only local prototype or as an AWS-connected serverless application.

## What is new in 2.2

- Administrator escrow release and buyer-refund controls for every held order
- Mandatory administrator reasons for escrow decisions
- Detailed escrow decision records and administrator audit-log entries
- Duplicate release/refund prevention at the transaction layer
- Administrator access to inspect every conversation
- Permanent message warning that administrators may review chat and users must not share private information
- Clickable admin user records with profiles, listings, orders, wallet history and messages
- Clickable listings and owners throughout moderation screens
- A separate recycling-request workflow instead of recycling marketplace listings
- User recycling submission, status history and administrator messaging
- Administrator approve, reject and complete controls with mandatory notes
- A much larger total wallet value with clear available and held balances
- Responsive desktop header search with a stable width and clear focus expansion
- Clickable member avatars and names that open privacy-safe public profiles
- Public member profiles with join date, time on platform, ratings, completed trades, active listings and reviewer comments
- AWS API Gateway, Lambda, DynamoDB, S3 and CloudFormation implementation
- Explicit browser CORS preflight handling for S3-hosted frontend requests
- Amazon Cognito registration, email verification, password reset and signed JWT authentication
- Amazon SNS email-only sign-in security alerts created through Cognito Post Confirmation and Post Authentication triggers
- API Gateway JWT authorization, scoped API responses and server-side role checks
- Manual AWS Academy deployment through Cognito, API Gateway, Lambda and Amplify Hosting
- Atomic DynamoDB state updates and idempotency protection for escrow actions
- Real-email registration, email verification and password recovery
- Two-role access model: standard users and administrators

## Run locally

Open the `frontend` folder in VS Code, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the exact localhost address shown by Vite.

To run the included escrow and data-integrity checks:

```powershell
npm.cmd test
```

To verify the production build:

```powershell
npm.cmd run build
```

## Account and role model

- A person registers with their own email and receives the `user` role.
- Every user can both buy and sell; buyer and seller are transaction positions, not separate account roles.
- Administrators supervise users, listings, escrow, recycling and conversations.
- Administrator access is granted only by adding a confirmed Cognito account to the `Admins` group.
- The public registration form can never create an administrator.

## Deploy to AWS

For a fresh AWS Academy-compatible manual deployment in **US East (N. Virginia) `us-east-1`**, follow `MANUAL_DEPLOYMENT_US_EAST_1.md`. It rebuilds DynamoDB, S3, Cognito, SNS, Lambda, API Gateway and Amplify while reusing the Student Lab `LabRole`.

Read `AWS_DEPLOYMENT.md` for the architecture, security controls, validation checklist, troubleshooting and production upgrade path.

## Important

Local mode stores data in browser `localStorage`. AWS mode uses Cognito for accounts, DynamoDB for application state, S3 for files, API Gateway/Lambda for the backend, SNS for filtered email-only sign-in alerts, and Amplify Hosting for the HTTPS frontend.

Public profiles intentionally exclude email addresses, wallet history, orders, private messages and moderation information. Those records remain visible only to their owner or an authorized administrator.

E-Tokens are prototype credits only. They are not money and cannot be withdrawn.
