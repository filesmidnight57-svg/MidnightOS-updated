MIDNIGHTOS UPDATED BUILD

Updates included:
1. Hindi subtitles moved to the bottom safe area.
2. Subtitle font made smaller with a readable dark background box.
3. Automatic 2-second MIDNIGHTOS intro card.
4. Automatic 2-second CASE STATUS outro card.
5. Voice and subtitle timing automatically shifted after the intro.
6. Existing six scenes, zoom/pan, Hindi voice, music and sound effects preserved.

RUN:
1. Open this folder in VS Code.
2. Run: npm install
3. Confirm assets/audio/horror_background.mp3 exists.
4. Run: npm start
5. Final video: output/CASE-000001/horror_video.mp4

Note: Rendering six 1080x1920 scenes can take several minutes.

YOUTUBE PUBLISHING:
1. Generate the project first so these files exist:
   - output/CASE-000001/horror_video.mp4
   - output/CASE-000001/thumbnail.png
   - output/CASE-000001/youtube.json
2. In Google Cloud Console, create or choose a project.
3. Enable YouTube Data API v3 for that project.
4. Configure the OAuth consent screen and add the scope:
   https://www.googleapis.com/auth/youtube.upload
5. Create an OAuth 2.0 Client ID for a Desktop app or Web app.
6. Add these values to .env:
   YOUTUBE_CLIENT_ID=your_client_id
   YOUTUBE_CLIENT_SECRET=your_client_secret
   YOUTUBE_REDIRECT_URI=http://localhost:53682/oauth2callback
7. Run OAuth setup and approve the upload permission:
   npm run youtube:auth
8. Copy the printed refresh token into .env:
   YOUTUBE_REFRESH_TOKEN=your_refresh_token
9. Choose visibility with one of:
   YOUTUBE_PRIVACY_STATUS=private
   YOUTUBE_PRIVACY_STATUS=unlisted
   YOUTUBE_PRIVACY_STATUS=public
10. Dry-run validation is the default and never uploads:
   npm run publish
11. Real upload requires an explicit live mode:
   YOUTUBE_PUBLISH_MODE=live npm run publish
12. The publisher writes:
   output/CASE-000001/upload_report.json

The YouTube publisher uses OAuth 2.0 and the official YouTube Data API v3 endpoints for video insert, thumbnail set, and token refresh. It uses the latest output/CASE-###### folder by default, and #Shorts is added to the description when missing.
