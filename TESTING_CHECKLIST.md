# E-Swap 2.2 testing checklist

For AWS testing, register accessible email addresses through the application. Every
public registration is a standard user that can both buy and sell. Promote only the
supervisor account through the Cognito `Admins` group.

## Automated gates

1. In `aws/backend`, run `npm.cmd test` and confirm all backend and SNS tests pass.
2. In `frontend`, run `npm.cmd test`.
3. Confirm `E-Swap 2.2 invariant checks passed`.
4. Run `npm.cmd run build`.
5. Confirm Vite finishes without an error.

## SNS email-only sign-in alert

1. Confirm the Standard topic is named `e-swap-user-login-alerts`.
2. Confirm Lambda has `LOGIN_ALERT_TOPIC_ARN` and uses `LabRole`.
3. Confirm Cognito Post Confirmation and Post Authentication both target `e-swap-2-2-api`.
4. Register and verify a real-email user.
5. Open the AWS SNS subscription-confirmation email and click **Confirm subscription**.
6. Confirm the subscription protocol is `email`, not SMS or mobile push.
7. Log out, sign in again and confirm the subject is `E-Swap security alert: new sign-in`.
8. With two confirmed users, confirm each address receives only its own sign-in alert.
9. Check CloudWatch for `E-Swap login alert published` and no SNS permission errors.

## Standard-user buying journey

1. Register and verify the first real-email user, then log in.
2. Click another member's avatar or name and confirm their public profile opens.
3. Confirm the profile shows join date, time on the platform, rating and reviewer comments but not email, wallet or private messages.
4. Open **Wallet** and confirm **Total wallet value** is the largest balance.
5. Confirm available and held balances are shown separately.
6. Open **Orders** and inspect the iPad order with 300 tokens held.
7. Open its chat and confirm the permanent privacy/admin-review warning appears.
8. Confirm the item was received and verify tokens leave escrow once.
9. Attempting to process the same order again must not expose another release action.
10. Leave a review, save an item, send a message and submit a report.

## Standard-user recycling journey

1. Open **Recycling** from the navigation.
2. Submit a recycling request with device, condition, quantity and location.
3. Confirm it appears as **Submitted** with a status-history entry.
4. Send a message to the recycling team from the request card.
5. Log in with the real-email account assigned to Cognito's `Admins` group and open **Recycling**.
6. Approve the request with a required note.
7. Return as the requester and confirm the approval, note, notification and message update.
8. Return as administrator and complete the approved request with a required completion note.

## Administrator escrow journey

1. Log in with the real-email account assigned to Cognito's `Admins` group.
2. Open **Orders & escrow**.
3. Confirm every held order has **Release / refund** controls, not only disputes.
4. Open a control and verify both buttons stay disabled until a reason is entered.
5. Release one held order to its seller.
6. Verify the order is completed, the seller wallet increased and an `ADMIN ESCROW RELEASED` audit entry exists.
7. Verify the processed order no longer exposes release/refund controls.
8. Create a separate held order and refund it to the buyer.
9. Verify that listing becomes active, the buyer available balance increases and an `ADMIN ESCROW REFUNDED` audit entry exists.

## Administrator inspection journey

1. Open **Users** and click a user name or listing-count badge.
2. Confirm the inspector shows profile, listings, orders, complete wallet history and conversations.
3. Open a listing from the inspector and check its full detail page.
4. Open **Listings** and confirm images/titles are clickable for moderation.
5. Open **Messages** and inspect conversations between users who do not include the administrator.
6. Confirm the warning explains that all conversations are administrator-reviewable.
7. Open a recycling conversation and send a message to its requester.
8. Open **Audit log** and search for escrow or recycling decisions.

## Responsive checks

- Desktop width
- Narrow desktop window
- Tablet width
- Mobile width and navigation
- Messages and admin conversation inspector
- Recycling form and request cards
- Orders and administrator tables scroll horizontally
- Modal dialogs remain usable on small screens
