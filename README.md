# 📸 Instagram Reel & Post Downloader Bot (`@hqdownloaderbot`)

Production-ready backend service for an Instagram DM downloader bot that uses Telegram strictly as an invisible headless storage bucket, delivers interactive Quick Reply buttons, and serves 24-hour expiring download landing pages.

Designed to run seamlessly on **Vercel** serverless and locally in Node.js.

---

## 🌟 Key Features

1. **Invisible Telegram Cloud Storage (Zero Redirection)**:
   - Extracted Reel videos and audio tracks are silently uploaded to a private Telegram storage channel via Telegram Bot API (`sendVideo` / `sendAudio`).
   - Telegram storage files are **never deleted**.
   - Users are **never** redirected to Telegram, asked to join a channel, or shown `t.me` links. Telegram is used strictly as an invisible, limitless cloud storage backend.

2. **Interactive Instagram DM Quick Replies**:
   - When a user sends an Instagram Reel or Post link, the bot immediately replies with native interactive buttons:
     ```
     Hey! 👋 Got that reel. What do you want?

       🎬  1  — Video (highest quality MP4)
       🎵  2  — Audio only (voice note + MP3 link)
       📦  3  — Both (video + audio)

     Just tap the button below 👇
     ```
   - Also accepts typing `1`, `2`, or `3` as text replies.

3. **Rich Caption & Direct Media Delivery**:
   - Sends media attachments directly in DM (video file and audio note).
   - Delivers a structured caption with original creator, caption text, bug report prompt (`@jxfr.in`), and 24-hour expiring download links:
     ```
     🎬🎵 Here's your video + audio!

     👤 Noor.
     📝 I’ve been wanting to try this trend for so long...

     🔥 Trending Audio

     💡 Follow @jxfr.in to keep using this tool!
     ⚠️ Found a bug or error? Screenshot it and send to acc @jxfr.in

     📥 Download HQ MP4: https://hqdownloaderbot.vercel.app/dl/rrlfek
     📥 Download MP3: https://hqdownloaderbot.vercel.app/dl/cg6fqg
     ```

4. **24-Hour Expiring Web Interface (`/dl/:id`)**:
   - **Active State (`<= 24h`)**:
     - Modern glassmorphism UI with embedded video / audio player.
     - **Live Countdown Timer** updating in real-time (`23h 48m 12s`).
     - **"Download HQ MP4" / "Download MP3" button** linking directly to the Telegram CDN with the HTML5 `download` attribute, downloading straight to the user's browser without consuming server RAM or bandwidth.
   - **Expired State (`> 24h`)**:
     - Clean warning page: **"Download Link Expired"**.
     - Dynamic relative elapsed time calculated via `dayjs` (e.g., *"Expired 1 hour ago"*, *"Expired 23 minutes ago"*, *"Expired 2 days ago"*).
     - No download buttons or media assets are rendered.

5. **Vercel Serverless Ready**:
   - Uses Meta official Instagram Messenger Webhooks (`GET /webhook` and `POST /webhook`), completely ban-proof, zero checkpoint challenges, and natively supported on Vercel.
   - **Dual Database Engine**: Automatically uses PostgreSQL (`DATABASE_URL`, e.g., Neon or Supabase) in production / Vercel, and persistent local storage when running locally.

---

## 📁 Project Structure

```text
├── api/
│   └── index.js                    # Vercel Serverless Function entry point
├── src/
│   ├── app.js                      # Express application & middleware
│   ├── server.js                   # Local server entry point
│   ├── controllers/
│   │   ├── downloadController.js   # Handles GET /dl/:id (active & expired)
│   │   └── webhookController.js    # Meta webhook verification & message router
│   ├── db/
│   │   └── index.js                # Dual-engine DB (PostgreSQL + Local File)
│   ├── services/
│   │   ├── instagramExtractor.js   # Multi-tier Reel video & audio scraper
│   │   ├── metaMessenger.js        # Meta Graph API sender (Quick Replies, Media, Captions)
│   │   └── telegramStorage.js      # Headless Telegram storage & CDN URL resolver
│   └── views/
│       └── downloadView.js         # Responsive HTML/CSS landing pages (Active & Expired)
├── tests/
│   ├── test-flow.js                # End-to-end integration test suite
│   └── test-http.js                # Live HTTP API integration test
├── .env.example                    # Environment variables template
├── package.json
└── vercel.json                     # Vercel routing configuration
```

---

## 🚀 Step-by-Step Setup Guide

### 1. Telegram Invisible Storage Setup

1. Open Telegram and search for [`@BotFather`](https://t.me/BotFather).
2. Send `/newbot`, choose a name, and copy the **HTTP API Token** (e.g. `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`).
3. Create a **New Private Channel** in Telegram (e.g. `IG Media Vault`).
4. In Channel Settings > Administrators > Add your bot as an **Administrator** with permission to **Post Messages**.
5. Get the channel ID:
   - Forward any message from the channel to [`@userinfobot`](https://t.me/userinfobot) or [`@JsonDumpBot`](https://t.me/JsonDumpBot).
   - The ID starts with `-100` (e.g. `-1001234567890`).

### 2. Instagram Bot Account Setup (Meta for Developers)

> [!NOTE]
> To use interactive Quick Reply buttons and receive webhooks without getting your account flagged or banned by Instagram, Meta requires linking an Instagram Professional Account to a Facebook Page.

1. Convert your `@hqdownloaderbot` Instagram account to a **Professional / Creator Account** (in Instagram Settings > Account Type).
2. Go to [Meta for Developers](https://developers.facebook.com/) and create a new App (Type: **Business** or **Other**).
3. Add the **Instagram** product to your app.
4. Under **Instagram > Basic Display / API Setup**, link your Facebook Page that is connected to `@hqdownloaderbot`.
5. Generate a **Page Access Token** with permissions:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
6. Set your custom **Verify Token** (e.g. any secure random string like `hq_verify_token_999`).

### 3. Database Setup (Free PostgreSQL for Vercel)

Since Vercel lambdas are stateless and ephemeral:
1. Create a free PostgreSQL database on [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
2. Copy the Connection String URI (`postgresql://user:password@ep-...neon.tech/neondb?sslmode=require`).
3. The app will automatically initialize the `downloads` and `user_sessions` tables on startup!

---

## 💻 Running Locally

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd "ig bot"
   npm install
   ```

2. **Configure `.env`**:
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. **Run the Test Suite**:
   ```bash
   npm test
   node tests/test-http.js
   ```

4. **Start the Local Development Server**:
   ```bash
   npm run dev
   ```

5. **Expose Localhost to Meta (for local webhook testing)**:
   Use ngrok to expose port 3000:
   ```bash
   ngrok http 3000
   ```
   Set your Webhook Callback URL in Meta App Dashboard:
   `https://<your-ngrok-subdomain>.ngrok-free.app/webhook`
   Verify Token: `<your INSTAGRAM_VERIFY_TOKEN>`

---

## ☁️ Deploying to Vercel

### Method 1: Deploy with Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Run deployment:
   ```bash
   vercel
   ```
3. Add Environment Variables in the [Vercel Project Dashboard](https://vercel.com/dashboard) under **Settings > Environment Variables**:
   - `BASE_URL`: `https://your-project.vercel.app`
   - `INSTAGRAM_PAGE_ACCESS_TOKEN`: `<your Meta Page Access Token>`
   - `INSTAGRAM_VERIFY_TOKEN`: `<your Verify Token>`
   - `TELEGRAM_BOT_TOKEN`: `<your Telegram Bot Token>`
   - `TELEGRAM_STORAGE_CHANNEL_ID`: `<your Telegram Channel ID>`
   - `DATABASE_URL`: `<your Neon or Supabase Postgres URL>`
   - `BOT_USERNAME`: `hqdownloaderbot`
   - `SUPPORT_ACCOUNT`: `@jxfr.in`
   - `FOLLOW_GATE_ACCOUNT`: `@jxfr.in`
4. Deploy to production:
   ```bash
   vercel --prod
   ```

### Method 2: Deploy via GitHub

1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Import**.
3. Under **Environment Variables**, paste the variables from `.env.example`.
4. Click **Deploy**.

### Configure Meta Webhook URL:
Once deployed on Vercel, navigate to **Meta Developer Portal > Instagram > Webhooks**:
- **Callback URL**: `https://your-project.vercel.app/webhook`
- **Verify Token**: `<your INSTAGRAM_VERIFY_TOKEN>`
- **Subscription Fields**: Check `messages` and `messaging_postbacks`.

---

## 🧪 Testing the Web Landing Pages

You can test the landing pages directly in your browser:

- **Active Link with Live Countdown & Direct CDN**:
  Navigate to `http://localhost:3000/dl/active_test_123` (after running tests or generating a link).
- **Expired Link with Dynamic Relative Time**:
  Navigate to `http://localhost:3000/dl/expired_test_456`. You will see the **"Download Link Expired"** page showing the relative time (e.g. *"Expired 2 hours ago"*) with no media assets.

---

## 🛡️ Support & Inquiries

Found a bug or need assistance?
- Screenshot and send to **[@jxfr.in](https://instagram.com/jxfr.in)** on Instagram.
