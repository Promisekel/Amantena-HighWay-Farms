# Amantena Highway Farms Dashboard

Modern React dashboard for managing inventory, sales, analytics, and notifications for Amantena Highway Farms. The project now includes Firebase Cloud Functions to power support-request emails.

## Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore and Authentication enabled

## Frontend Setup

```bash
cd amantena-farms
npm install
npm start
```

Environment variables live in `.env`; see `.env.example` for the required keys.

## Cloud Functions (Support Email Service)

The new `functions/` directory contains a callable Cloud Function named `sendEmailNotification` that sends support messages to `classiqcode@gmail.com` using SMTP credentials stored in Firebase config.

### 1. Install dependencies

```bash
cd functions
npm install
```

### 2. Configure SMTP credentials

```bash
firebase functions:config:set \
	email.user="your-smtp-username" \
	email.pass="your-smtp-password" \
	email.from="Highway Farm Support <support@yourdomain.com>"
```

Optional overrides:

- `email.host` (defaults to `smtp.gmail.com`)
- `email.port` (defaults to `465`)
- `email.secure` (defaults to `true`)

### 3. Deploy the function

```bash
firebase deploy --only functions
```

Or run locally:

```bash
firebase emulators:start --only functions
```

## Support Request Flow

- Users open the sidebar “Get Support” modal.
- Submitting the form calls `sendSupportRequestEmail` in `src/services/emailNotifications.js`.
- The callable Cloud Function sends the email to `classiqcode@gmail.com` and logs the request in Firestore (`support-requests`).
- Toast notifications provide live feedback for success or failure.

## Scripts

| Command | Location | Description |
| --- | --- | --- |
| `npm start` | `amantena-farms/` | Run the React dev server |
| `npm run build` | `amantena-farms/` | Production build |
| `npm test` | `amantena-farms/` | React testing library |
| `npm run deploy` | `functions/` | Deploy Cloud Functions |

## Troubleshooting

- **No email sent?** Ensure Cloud Functions are deployed and SMTP credentials are set with `firebase functions:config:set`.
- **Permission errors?** Confirm the logged-in user is listed in `settings/app-settings.authorizedEmails`.
- **Toast not showing?** Check the browser console for errors when submitting the support form.
