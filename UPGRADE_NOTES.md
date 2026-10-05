# Upgrade notes from E-Swap 2.1 to 2.2

E-Swap 2.2 uses new browser-storage keys, so its optional local-test data does not overwrite an existing E-Swap 2.1 local test database.

The main schema additions are:

- `meta.schemaVersion`
- `recyclingRequests`
- recycling conversation subjects and request references
- `order.escrowDecision` after a release or refund
- detailed audit metadata for administrator escrow and recycling decisions

The package now has two runtime modes:

- **Local mode** keeps browser-only sample data and separate 2.2 storage keys.
- **AWS mode** uses real-email Cognito identities, API Gateway JWT authorization, Lambda, DynamoDB, S3 and Amplify Hosting.

The SNS email integration has been restored for AWS mode. Cognito Post Confirmation requests a filtered email subscription for the new user's address, while Post Authentication publishes a best-effort sign-in security alert. SNS is email-only; SMS and mobile push are not configured. The Lambda environment variable is `LOGIN_ALERT_TOPIC_ARN` and the topic name is `e-swap-user-login-alerts`.

When an existing AWS 2.2 backend is updated, the migration preserves DynamoDB marketplace data and removes legacy password material. New registrations use the person's verified Cognito email. Every public registration receives the `user` role and can both buy and sell; administrator access is assigned only through the Cognito `Admins` group.

E-Swap 2.2 enforces duplicate escrow prevention in the backend with a conditional state-version write and action idempotency, as well as hiding already-processed controls in the interface.

Public member pages expose only marketplace trust details: name, avatar, location, biography, join date, completed trades, active listings and reviews. Email addresses, wallets, orders and messages are not public.
