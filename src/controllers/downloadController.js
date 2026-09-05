import { getDownloadRecord } from '../db/index.js';
import { getDirectTelegramFileUrl } from '../services/telegramStorage.js';
import { renderActivePage, renderExpiredPage } from '../views/downloadView.js';

/**
 * Controller for GET /dl/:id
 */
export async function handleDownloadPage(req, res) {
  try {
    let { id } = req.params;
    if (!id) {
      return res.status(400).send('Invalid or missing download ID.');
    }

    // Strip common file extensions if passed in URL (e.g., /dl/abc1234.mp4 -> abc1234)
    id = id.replace(/\.(mp4|mp3|m4a|mov|jpg|webp)$/i, '');

    const record = await getDownloadRecord(id);
    const botUsername = process.env.BOT_USERNAME || 'hqdownloaderbot';

    if (!record) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Not Found - @${botUsername}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="background:#0d0f17;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
          <div style="background:#161c2d;padding:32px;border-radius:16px;border:1px solid #374151;max-width:400px;width:100%;">
            <h2 style="color:#ef4444;margin-bottom:12px;">Link Not Found</h2>
            <p style="color:#9ca3af;font-size:14px;line-height:1.5;">This download token does not exist or may have been deleted.</p>
            <a href="https://instagram.com/${botUsername}" style="display:inline-block;margin-top:20px;color:#818cf8;text-decoration:none;font-weight:600;">← Back to Instagram Bot</a>
          </div>
        </body>
        </html>
      `);
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    // 1. Check if token is EXPIRED (current_time > expires_at)
    if (now > expiresAt) {
      const html = renderExpiredPage({
        id: record.id,
        expiresAt: record.expires_at,
        botUsername
      });
      return res.status(410).send(html);
    }

    // 2. Token is ACTIVE: Resolve direct Telegram CDN file URL
    let directCdnUrl;
    try {
      directCdnUrl = await getDirectTelegramFileUrl(record.file_id);
    } catch (cdnErr) {
      console.error(`[DownloadController] Error fetching CDN URL for ${record.file_id}:`, cdnErr.message);
      return res.status(502).send(`
        <div style="background:#111827;color:#fff;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Storage CDN Error</h3>
          <p style="color:#9ca3af;">Unable to fetch direct file stream from storage. Please try again in a few moments.</p>
        </div>
      `);
    }

    // Direct redirect query param support (e.g., /dl/:id?redirect=1)
    if (req.query.redirect === '1' || req.query.download === '1') {
      return res.redirect(directCdnUrl);
    }

    // 3. Render modern responsive landing page
    const html = renderActivePage({
      id: record.id,
      mediaType: record.media_type,
      directCdnUrl,
      creatorName: record.creator_name,
      caption: record.caption,
      expiresAt: record.expires_at,
      botUsername
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[DownloadController] Unexpected error:', err);
    return res.status(500).send('Internal Server Error processing download request.');
  }
}
