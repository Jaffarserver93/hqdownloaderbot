import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(relativeTime);

/**
 * Render the HTML page for an EXPIRED download link
 */
export function renderExpiredPage({ id, expiresAt, botUsername = 'hqdownloaderbot' }) {
  const expiredAgo = dayjs(expiresAt).fromNow(); // e.g., "1 hour ago", "23 minutes ago", "2 days ago"
  const formattedExpiredDate = dayjs(expiresAt).format('YYYY-MM-DD HH:mm:ss UTC');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Link Expired - @${botUsername}</title>
  <style>
    :root {
      --bg-dark: #0d0f17;
      --card-bg: rgba(26, 31, 46, 0.85);
      --card-border: rgba(255, 75, 75, 0.3);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --accent: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top, #1e1b4b 0%, #0d0f17 100%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.15);
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrapper {
      width: 72px;
      height: 72px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
      color: var(--danger);
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
    }
    .alert-badge {
      display: inline-block;
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
      padding: 6px 16px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
      border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .expired-time {
      font-size: 16px;
      color: var(--text-main);
      margin-bottom: 8px;
    }
    .expired-time strong {
      color: #f87171;
    }
    .info-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .btn-return {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
      width: 100%;
    }
    .btn-return:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }
    .token-ref {
      font-size: 12px;
      color: #6b7280;
      margin-top: 20px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">⏳</div>
    <h1>Download Link Expired</h1>
    <div class="alert-badge">Status: Link Inactive</div>
    <div class="expired-time">
      This download token <strong>expired ${expiredAgo}</strong>.
    </div>
    <div class="info-box">
      For security and privacy, all generated media links strictly self-destruct after <strong>24 hours</strong>. No media files can be retrieved using this token.
    </div>
    <a href="https://instagram.com/${botUsername}" class="btn-return" target="_blank" rel="noopener">
      <span>Get Fresh Link on Instagram</span> ↗
    </a>
    <div class="token-ref">Token: ${id} • Expired at ${formattedExpiredDate}</div>
  </div>
</body>
</html>`;
}

/**
 * Render the HTML page for an ACTIVE download link
 */
export function renderActivePage({
  id,
  mediaType = 'video',
  directCdnUrl,
  creatorName,
  caption,
  expiresAt,
  botUsername = 'hqdownloaderbot'
}) {
  const expiresTimestamp = new Date(expiresAt).getTime();
  const isVideo = mediaType === 'video';
  const cleanCreator = creatorName || 'Instagram Creator';
  const displayCaption = caption ? caption.slice(0, 160) : 'Instagram Reel';
  const fileExtension = isVideo ? 'mp4' : 'm4a';
  const downloadFileName = `Instagram_${cleanCreator.replace(/[^a-zA-Z0-9]/g, '_')}_${id}.${fileExtension}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download ${isVideo ? 'Reel Video' : 'Audio'} - @${botUsername}</title>
  <style>
    :root {
      --bg-dark: #0b0f19;
      --card-bg: rgba(22, 28, 45, 0.85);
      --card-border: rgba(99, 102, 241, 0.25);
      --primary-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
      --button-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --accent: #818cf8;
      --timer-bg: rgba(99, 102, 241, 0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0b0f19 80%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container {
      max-width: 520px;
      width: 100%;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: var(--primary-gradient);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(99, 102, 241, 0.2);
      color: #c7d2fe;
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }
    .creator-tag {
      font-size: 14px;
      color: var(--accent);
      margin-bottom: 20px;
    }
    .media-player-container {
      background: #000;
      border-radius: 16px;
      overflow: hidden;
      margin: 16px 0 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    video {
      width: 100%;
      max-height: 380px;
      display: block;
      background: #000;
      object-fit: contain;
    }
    audio {
      width: 100%;
      margin: 20px 0;
    }
    .audio-wrapper {
      padding: 24px 16px;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 16px;
      margin: 16px 0 24px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .audio-icon {
      font-size: 42px;
      margin-bottom: 8px;
    }
    .timer-container {
      background: var(--timer-bg);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 14px;
      padding: 12px 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .timer-icon {
      font-size: 18px;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.92); }
    }
    .timer-label {
      font-size: 13px;
      color: #c7d2fe;
    }
    .timer-digits {
      font-weight: 700;
      font-size: 16px;
      color: #fff;
      letter-spacing: 0.5px;
      font-family: monospace;
    }
    .btn-download {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--button-gradient);
      color: #ffffff;
      text-decoration: none;
      font-size: 17px;
      font-weight: 700;
      padding: 16px 28px;
      border-radius: 14px;
      transition: all 0.25s ease;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
      width: 100%;
    }
    .btn-download:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.5);
    }
    .cdn-note {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 14px;
      line-height: 1.4;
    }
    .footer-support {
      margin-top: 24px;
      font-size: 13px;
      color: #6b7280;
    }
    .footer-support a {
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="badge">
        <span>⚡ Ready to Save</span>
      </div>

      <h1>${isVideo ? '🎬 Instagram Reel Video' : '🎵 Instagram Reel Audio'}</h1>
      <div class="creator-tag">Original creator: <strong>@${cleanCreator}</strong></div>

      <!-- Media Preview -->
      ${isVideo ? `
        <div class="media-player-container">
          <video controls preload="metadata" playsinline>
            <source src="${directCdnUrl}" type="video/mp4">
            Your browser does not support video playback.
          </video>
        </div>
      ` : `
        <div class="audio-wrapper">
          <div class="audio-icon">🎧</div>
          <audio controls preload="metadata">
            <source src="${directCdnUrl}" type="audio/mp4">
            <source src="${directCdnUrl}" type="audio/mpeg">
            Your browser does not support audio playback.
          </audio>
        </div>
      `}

      <!-- Live Expiration Countdown Timer -->
      <div class="timer-container">
        <span class="timer-icon">⏳</span>
        <span class="timer-label">Link expires in:</span>
        <span class="timer-digits" id="countdown">Calculating...</span>
      </div>

      <!-- Direct Telegram CDN Download Button -->
      <a href="${directCdnUrl}" download="${downloadFileName}" class="btn-download">
        <span>📥 Download ${isVideo ? 'HQ MP4 Video' : 'MP3 Audio'}</span>
      </a>

      <p class="cdn-note">
        Direct high-speed CDN transfer • Zero server bottleneck
      </p>

      <div class="footer-support">
        Bot by <a href="https://instagram.com/${botUsername}" target="_blank">@${botUsername}</a> • Need help? <a href="https://instagram.com/jxfr.in" target="_blank">@jxfr.in</a>
      </div>
    </div>
  </div>

  <script>
    const targetTimestamp = ${expiresTimestamp};
    const countdownEl = document.getElementById('countdown');

    function updateCountdown() {
      const now = Date.now();
      const distance = targetTimestamp - now;

      if (distance <= 0) {
        countdownEl.innerText = "EXPIRED";
        window.location.reload();
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');

      countdownEl.innerText = \`\${hh}h \${mm}m \${ss}s\`;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
  </script>
</body>
</html>`;
}
