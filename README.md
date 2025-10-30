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

## Deploying to Vercel

The repository root contains `vercel.json` so Vercel builds from the `amantena-farms/` subdirectory without extra configuration.

1. Push changes to GitHub and import the repo in Vercel.
2. On first deploy, Vercel reads `vercel.json` and runs:
	- `npm install` inside `amantena-farms/`
	- `npm run build` inside `amantena-farms/`
3. Add the required environment variables (same keys as `.env.example`). In Vercel → Project Settings → Environment Variables, use the names referenced in `vercel.json` (e.g. `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_CLOUDINARY_CLOUD_NAME`).
4. Redeploy to produce the static build served from `amantena-farms/build`.

> Tip: use Vercel secrets (e.g. `vercel env add`) to store sensitive values, then map them in `vercel.json` via the `@secret-name` syntax already provided.
