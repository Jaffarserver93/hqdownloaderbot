import axios from 'axios';

/**
 * Regex patterns to extract Instagram shortcode from various link formats:
 * - https://www.instagram.com/reel/C7-Xyz...
 * - https://www.instagram.com/reels/C7-Xyz...
 * - https://www.instagram.com/p/C7-Xyz...
 * - https://www.instagram.com/tv/C7-Xyz...
 * - https://instagram.com/share/reel/...
 */
export function extractInstagramShortcode(url) {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    /instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/share\/reel\/([A-Za-z0-9_-]+)/i,
    /instagr\.am\/(?:p|reel)\/([A-Za-z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extracts any Instagram URL from an arbitrary text message
 */
export function findInstagramUrlInText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s"']+/i);
  return match ? match[0] : null;
}

/**
 * Extracts an Instagram Reel or Post URL from any Meta message object
 * Handles:
 * - Direct text links (https://instagram.com/reel/...)
 * - Shared Reel cards via the Instagram paper plane icon (message.attachments)
 * - Instagram share sheet objects (message.share)
 */
export function extractInstagramUrlFromMessage(message) {
  if (!message) return null;

  // 1. Plain text check
  if (message.text) {
    const found = findInstagramUrlInText(message.text);
    if (found) return found;
  }

  // 2. Attachments check (shared Reel, shared Post, story share)
  if (Array.isArray(message.attachments)) {
    for (const att of message.attachments) {
      if (att.payload?.url) {
        const found = findInstagramUrlInText(att.payload.url);
        if (found) return found;
      }
      if (att.url) {
        const found = findInstagramUrlInText(att.url);
        if (found) return found;
      }
    }
  }

  // 3. Share sheet link
  if (message.share?.link) {
    const found = findInstagramUrlInText(message.share.link);
    if (found) return found;
  }

  // 4. Fallback search across stringified message object
  try {
    const raw = JSON.stringify(message);
    const found = findInstagramUrlInText(raw);
    if (found) return found;
  } catch {}

  return null;
}

/**
 * Extract Reel / Post media and metadata from Instagram
 * Supports multiple fallback methods for maximum resilience.
 */
export async function extractInstagramMedia(url) {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) {
    throw new Error('Invalid Instagram URL. Could not extract post/reel shortcode.');
  }

  console.log(`[Extractor] Fetching Instagram media for shortcode: ${shortcode}`);

  // Attempt 1: Scrape Instagram Embed Page (Fast, lightweight, no credentials needed)
  try {
    const embedResult = await extractFromEmbed(shortcode);
    if (embedResult && embedResult.videoUrl) {
      console.log('[Extractor] Successfully extracted via Instagram Embed.');
      return embedResult;
    }
  } catch (err) {
    console.warn(`[Extractor] Embed extraction failed: ${err.message}`);
  }

  // Attempt 2: Scrape Instagram JSON endpoint
  try {
    const jsonResult = await extractFromJsonEndpoint(shortcode);
    if (jsonResult && jsonResult.videoUrl) {
      console.log('[Extractor] Successfully extracted via JSON endpoint.');
      return jsonResult;
    }
  } catch (err) {
    console.warn(`[Extractor] JSON endpoint extraction failed: ${err.message}`);
  }

  // Attempt 3: Public reliable proxy/downloader fallback
  try {
    const fallbackResult = await extractFromFallbackApi(shortcode);
    if (fallbackResult && fallbackResult.videoUrl) {
      console.log('[Extractor] Successfully extracted via Fallback API.');
      return fallbackResult;
    }
  } catch (err) {
    console.warn(`[Extractor] Fallback API extraction failed: ${err.message}`);
  }

  throw new Error(`Unable to extract video for Instagram shortcode ${shortcode}. The post may be private or restricted.`);
}

/**
 * Method 1: Scrape Instagram Embed /captioned/ endpoint
 */
async function extractFromEmbed(shortcode) {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  const response = await axios.get(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    },
    timeout: 10000
  });

  const html = response.data;

  // Extract video src
  let videoUrl = null;
  const videoSrcMatch = html.match(/class="EmbeddedVideo"[^>]*src="([^"]+)"/i) || 
                        html.match(/<video[^>]*src="([^"]+)"/i) ||
                        html.match(/"video_url":"([^"]+)"/i);
  if (videoSrcMatch) {
    videoUrl = decodeHtmlEntities(videoSrcMatch[1]).replace(/\\u0026/g, '&');
  }

  // Extract author username or full name
  let creatorName = 'Creator';
  const authorMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)<\/a>/i) ||
                      html.match(/class="UsernameText"[^>]*>([^<]+)<\/span>/i) ||
                      html.match(/"username":"([^"]+)"/i);
  if (authorMatch && authorMatch[1]) {
    creatorName = authorMatch[1].trim();
  }

  // Extract caption
  let caption = '';
  const captionMatch = html.match(/class="CaptionComments"[^>]*>[\s\S]*?class="Caption"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/"text":"([^"]+)"/i);
  if (captionMatch && captionMatch[1]) {
    caption = stripHtml(decodeHtmlEntities(captionMatch[1])).trim();
  }

  // Extract poster/thumbnail
  let thumbnailUrl = null;
  const posterMatch = html.match(/poster="([^"]+)"/i) || html.match(/"display_url":"([^"]+)"/i);
  if (posterMatch) {
    thumbnailUrl = decodeHtmlEntities(posterMatch[1]).replace(/\\u0026/g, '&');
  }

  if (videoUrl) {
    return {
      shortcode,
      videoUrl,
      // Video URL contains audio stream as well, so it can be served as audio source or directly
      audioUrl: videoUrl,
      creatorName,
      caption: caption || 'Instagram Reel',
      thumbnailUrl
    };
  }

  return null;
}

/**
 * Method 2: Fetch Instagram GraphQL / JSON endpoint
 */
async function extractFromJsonEndpoint(shortcode) {
  const infoUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
  const response = await axios.get(infoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 294.0.0.27.110',
      'Accept': 'application/json'
    },
    timeout: 10000
  });

  const data = response.data;
  const item = data?.graphql?.shortcode_media || data?.items?.[0];
  if (!item) return null;

  const videoUrl = item.video_url || item.video_versions?.[0]?.url;
  if (!videoUrl) return null;

  const creatorName = item.owner?.full_name || item.owner?.username || item.user?.username || 'Creator';
  const caption = item.edge_media_to_caption?.edges?.[0]?.node?.text || 
                  item.caption?.text || 
                  'Instagram Reel';
  const thumbnailUrl = item.display_url || item.image_versions2?.candidates?.[0]?.url;
  const audioUrl = item.audio_versions?.[0]?.audio_src || videoUrl;

  return {
    shortcode,
    videoUrl,
    audioUrl,
    creatorName,
    caption,
    thumbnailUrl
  };
}

/**
 * Method 3: Fallback open API
 */
async function extractFromFallbackApi(shortcode) {
  const targetUrl = `https://www.instagram.com/p/${shortcode}/`;
  const apiEndpoint = `https://api.vkrdownloader.com/v1/get?url=${encodeURIComponent(targetUrl)}`;

  const response = await axios.get(apiEndpoint, {
    timeout: 12000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const resData = response.data?.data;
  if (resData && resData.downloads) {
    const videoObj = resData.downloads.find(d => d.format_id?.includes('mp4') || d.ext === 'mp4') || resData.downloads[0];
    const audioObj = resData.downloads.find(d => d.format_id?.includes('m4a') || d.ext === 'mp3' || d.ext === 'm4a');

    return {
      shortcode,
      videoUrl: videoObj?.url || resData.url,
      audioUrl: audioObj?.url || videoObj?.url || resData.url,
      creatorName: resData.source || 'Creator',
      caption: resData.title || 'Instagram Reel',
      thumbnailUrl: resData.thumbnail || null
    };
  }

  return null;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u0026/g, '&');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ');
}
