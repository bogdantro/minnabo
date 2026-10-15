# Vipps login: return through minnaboapp.no (2026-10-14)

For the website project (`minnaboweb`). The app is moving the Vipps login return from
`minnabo://vipps/callback` to `https://minnaboapp.no/vipps/callback`, which Vipps recommends for
apps (a "universal link": iOS opens the app directly, with no "Åpne i MinNabo?" prompt). The website
needs two small things for that. Nothing else changes.

## 1. `/.well-known/apple-app-site-association`

Serve this JSON at exactly `https://minnaboapp.no/.well-known/apple-app-site-association`:

- status 200, `Content-Type: application/json`, no redirect, no file extension
- reachable without login and without cookies (Apple's servers fetch it)

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<TEAM_ID>.no.minnabo.app"],
        "components": [{ "/": "/vipps/callback*" }]
      }
    ]
  }
}
```

`<TEAM_ID>` is the 10-character Apple Team ID (developer.apple.com → Membership details). Only
`/vipps/callback` opens the app; every other page on the site stays a normal web page.

## 2. A page at `/vipps/callback`

Shown when the link is not opened by the app: the app is not installed, or the return happens
inside the iOS login window (the person has no Vipps app on the phone).

- If the URL has `code` and `state`: forward at once to
  `minnabo://vipps/callback?<the same query string, unchanged>`. The app's login window catches
  that address and finishes the login. Do it with a plain `<meta http-equiv="refresh">` plus a
  link "Fortsett i MinNabo-appen" as a fallback. Do not log or store the query string (it holds a
  one-time login code).
- If the URL has `error`: show "Innloggingen ble avbrutt" with a link to open the app.
- Otherwise: show "Last ned MinNabo" with the App Store link (`site.app_store_url`).
- `Cache-Control: no-store`, and `<meta name="robots" content="noindex">`.

## Check

```bash
curl -sI https://minnaboapp.no/.well-known/apple-app-site-association   # 200, application/json
curl -s  https://minnaboapp.no/.well-known/apple-app-site-association   # the JSON above
```
