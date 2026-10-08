# Dolphin Apps Slack app

This folder sets up the Slack side of Dolphin Apps:

- **Sign in with Slack** on apps.robotdolphins.org. It only works for existing Dolphin accounts and never creates new ones.
- A **Home tab** in Slack. Students see shop status, sign in/out buttons, their hours, the weekly leaderboard, and their tool sign-offs and badges.
- The existing **`/shop in CODE` / `/shop out CODE`** command, which works the same as before.

All Slack traffic goes to Convex HTTP actions. There is no extra server.

| Slack feature | Convex route | Code |
| --- | --- | --- |
| Slash command `/shop` | `/slack/commands` | `convex/shopSlack.ts` |
| Events (`app_home_opened`) | `/slack/events` | `convex/slackEvents.ts` |
| Buttons + modals | `/slack/interactions` | `convex/slackEvents.ts` |
| Sign in with Slack (OIDC) | `/api/auth/callback/slack` | `convex/auth.ts`, `convex/lib/slackIdentity.ts` |
| Home tab content | (none) | `convex/slackHome.ts` |
| Link backfill | (CLI / dashboard) | `convex/slackAdmin.ts` |

## Your existing links carry over

Slack user IDs (`U…`) belong to the workspace, not to the app. So every row already in `slackAccountLinks` (from `/shop` linking) keeps working, whether you update your current Slack app or create a new one. **Updating the current app is recommended**: it keeps the same bot token, signing secret, and channel memberships.

## Setup (about 20 minutes)

### 1. Set Convex environment variables

Use the Slack app you already have at <https://api.slack.com/apps>.

- From **Basic Information**, copy the Client ID, Client Secret, and Signing Secret.
- From **OAuth & Permissions**, copy the Bot User OAuth Token.
- For your workspace (team) ID, open Slack in a browser. The URL looks like `app.slack.com/client/T01234567/...`, and the `T…` part is the ID.

```bash
bunx convex env set AUTH_SLACK_ID        "1234567890.1234567890"   # Client ID
bunx convex env set AUTH_SLACK_SECRET    "xxxxxxxxxxxxxxxx"        # Client Secret
bunx convex env set SLACK_TEAM_ID        "T01234567"               # only this workspace can sign in
# Already set from /shop. Re-set only if they changed:
# bunx convex env set SLACK_SIGNING_SECRET "..."
# bunx convex env set SLACK_BOT_TOKEN      "xoxb-..."
```

Add `--prod` to each command to target your production deployment. `SITE_URL`, `JWT_PRIVATE_KEY`, and `JWKS` should already be set from your Convex Auth setup.

### 2. Deploy the code

Deploy before step 4, because Slack checks each URL when you save the manifest.

```bash
bun install
bun run deploy:convex      # or: bunx convex deploy
```

Push to GitHub as usual so Vercel deploys the new sign-in button.

### 3. Find your Convex HTTP Actions URL

In the Convex dashboard, go to **Settings → URL & Deploy Key** and copy the **HTTP Actions URL**. It ends in `.convex.site`, not `.convex.cloud`.

In `slack/manifest.json`, replace each `https://YOUR-DEPLOYMENT.convex.site` with it (there are 4).

### 4. Apply the manifest

1. Go to <https://api.slack.com/apps> and open your current attendance app.
2. In the left sidebar, open **App Manifest**, switch to **JSON**, and paste in `slack/manifest.json`.
   - If your current `/shop` command or app name differs, either edit the manifest to match or accept the new names.
3. Click **Save**. If Slack says a request URL isn't verified, open **Event Subscriptions** and click **Retry**.
4. Slack will ask you to **reinstall to workspace** because of the new scopes. Approve it. If the Bot User OAuth Token changes, update `SLACK_BOT_TOKEN`.

### 5. Link students automatically (by exact name)

Dolphin accounts don't have emails, so the backfill matches on **exact full name**. It compares each Slack user's full name or display name with the student or lead profile's first + last name or display name. Do a dry run first; it changes nothing:

```bash
bunx convex run slackAdmin:backfillLinks '{"dryRun": true}'
```

Read the report:

- `linked`: links it would create.
- `conflicts`: things it skipped on purpose, such as two profiles with the same name, two Slack users with the same name, or a Dolphin account already linked.
- `studentsStillUnlinked`: students who will need to click **Connect my account** themselves (or fix their Slack name to match and rerun).

Then apply it:

```bash
bunx convex run slackAdmin:backfillLinks '{"dryRun": false}'
```

It only ever touches **student and lead** profiles, because anyone can change their Slack name. Slack guests are skipped. Running it again is safe.

### 6. Turn on Slack sign-in for mentors and admins

Staff accounts never link by name, and a plain link isn't enough for them to sign in. An admin has to confirm each one:

1. The mentor opens the Dolphin Apps Home tab in Slack, clicks **Connect my account**, and signs in to the website with their password once.
2. You check the Slack name next to their account:
   ```bash
   bunx convex run slackAdmin:listStaffLinks
   ```
3. If it's really their Slack account, trust it:
   ```bash
   bunx convex run slackAdmin:trustStaffLink '{"username": "their.username"}'
   ```

`untrustStaffLink` reverses it. A link that gets moved to a different account loses its trust automatically.

### 7. Test it

- [ ] In Slack, click **Dolphin Apps** under *Apps* in the sidebar. The **Home** tab shows your name and hours.
- [ ] While the shop is open, click **Sign in to shop**, enter the code from a shop screen, and check that Home updates.
- [ ] Enter a wrong code. The modal should show "That shop code is expired or invalid."
- [ ] On apps.robotdolphins.org, sign out, then click **Sign in with Slack**. You land on your dashboard.
- [ ] Sign in with Slack using an account that isn't linked. You should see the "isn't connected yet" message.
- [ ] `/shop in CODE` still works.

## How Sign in with Slack decides who you are

`convex/lib/slackIdentity.ts`:

1. Rejects anyone outside `SLACK_TEAM_ID`. If `SLACK_TEAM_ID` isn't set, Slack sign-in is turned off completely.
2. Looks up the `slackAccountLinks` row for that Slack user. With no link there's no sign-in, and it never guesses.
3. Refuses inactive profiles and kiosk accounts.
4. **Staff (admin, mentor, instructor) also need a trusted link** (step 6). A student can't get admin access by tricking a mentor into clicking the student's "Connect" link.

It never creates a new Dolphin account. Accounts are still provisioned by admins, and the password login still works for everyone.

## Troubleshooting

- **Home tab says "This app's Home tab is under construction" or stays blank.** `app_home_opened` isn't reaching Convex. Check the Event Subscriptions URL, and look at Convex **Logs** for `views.publish failed`.
- **Sign in with Slack bounces back to the sign-in page.** In Convex Logs, `SLACK_SIGNIN_NO_MATCH` means the person isn't linked yet, and `SLACK_SIGNIN_WRONG_WORKSPACE` means `SLACK_TEAM_ID` is wrong, `SLACK_SIGNIN_NOT_CONFIGURED` means it isn't set, and `SLACK_SIGNIN_STAFF_NOT_TRUSTED` means a staff link hasn't been trusted yet (step 6). Also check that the redirect URL in the Slack app exactly matches `…convex.site/api/auth/callback/slack`.
- **`users.list failed: missing_scope`.** Reinstall the app after adding `users:read`.
