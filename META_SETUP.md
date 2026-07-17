# Meta setup

MidnightOS only uses the official Meta Graph API. It does not automate browsers or collect passwords.

## Facebook Page Reels

Create a Meta app, add the Facebook Login / Graph API products as required by Meta, obtain a Page access token for the target Page, and request the Page publishing permissions required by Meta for your app and use case (commonly `pages_manage_posts`, `pages_read_engagement`, and `pages_show_list`; Meta app review may be required). Set:

```text
FACEBOOK_UPLOAD_ENABLED=true
FACEBOOK_PAGE_ID=...
FACEBOOK_PAGE_ACCESS_TOKEN=...
META_GRAPH_API_VERSION=v24.0
```

MidnightOS validates the local MP4 with `ffprobe` before attempting Facebook. Configure `FACEBOOK_MAX_DURATION_SECONDS` only when your approved API flow imposes a known limit; an over-limit video is skipped rather than modifying the YouTube original.

## Instagram Reels

Use an Instagram Professional account connected to the Page and a token with the permissions Meta currently requires for content publishing (including `instagram_content_publish`, plus appropriate Page access). Set `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN` (or the shared Page token), and `INSTAGRAM_UPLOAD_ENABLED=true`.

Instagram's official publishing API requires `video_url` to be publicly reachable over HTTPS. Configure `PUBLIC_MEDIA_BASE_URL` to a secure server/CDN that serves the case video path, or `PUBLIC_MEDIA_STATIC_URL` for a pre-hosted integration test. If no HTTPS media host is configured, the dashboard and batch explicitly report **configuration required** and continue safely.

Never paste tokens into dashboard fields: MidnightOS has no token-entry API and redacts tokens in stored logs.
