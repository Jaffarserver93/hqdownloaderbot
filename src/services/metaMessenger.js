import axios from 'axios';

const GRAPH_API_VERSION = 'v21.0';

function getPageAccessToken() {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('INSTAGRAM_PAGE_ACCESS_TOKEN is not configured.');
  }
  return token;
}

/**
 * Sends a plain text message to an Instagram user via Meta Messenger API
 */
export async function sendInstagramTextMessage(recipientId, text) {
  const token = getPageAccessToken();

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text }
      },
      {
        params: { access_token: token },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    return response.data;
  } catch (err) {
    console.error(`[Meta Messenger] Error sending text message: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
}

/**
 * Sends a message with interactive Quick Reply buttons to Instagram DM
 */
export async function sendInstagramQuickReplies(recipientId, text, quickReplies) {
  const token = getPageAccessToken();

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          text,
          quick_replies: quickReplies.map(qr => ({
            content_type: 'text',
            title: qr.title.slice(0, 20), // Instagram limit for quick reply title is 20 chars
            payload: qr.payload
          }))
        }
      },
      {
        params: { access_token: token },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    return response.data;
  } catch (err) {
    console.error(`[Meta Messenger] Error sending quick replies: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
}

/**
 * Sends a media attachment (video or audio) directly to Instagram DM
 */
export async function sendInstagramMediaAttachment(recipientId, mediaType, mediaUrl) {
  const token = getPageAccessToken();

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: mediaType === 'audio' ? 'audio' : 'video',
            payload: {
              url: mediaUrl,
              is_reusable: true
            }
          }
        }
      },
      {
        params: { access_token: token },
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      }
    );
    return response.data;
  } catch (err) {
    console.error(`[Meta Messenger] Error sending ${mediaType} attachment: ${err.response?.data?.error?.message || err.message}`);
    // Non-fatal: if direct media upload fails, download links are still delivered via caption
    return null;
  }
}

/**
 * Builds the initial greeting message with interactive quick reply buttons
 */
export function buildGreetingQuickReplies() {
  const text = `Hey! 👋 Got that reel. What do you want?

  🎬  1  — Video (highest quality MP4)
  🎵  2  — Audio only (voice note + MP3 link)
  📦  3  — Both (video + audio)

Just tap the button below 👇`;

  const quickReplies = [
    { title: '🎬 1 — Video', payload: 'ACTION_VIDEO' },
    { title: '🎵 2 — Audio only', payload: 'ACTION_AUDIO' },
    { title: '📦 3 — Both', payload: 'ACTION_BOTH' }
  ];

  return { text, quickReplies };
}

/**
 * Builds the customized caption response according to user specifications
 */
export function buildDeliveryCaption({
  choiceType, // 'video' | 'audio' | 'both'
  creatorName,
  caption,
  videoDownloadUrl,
  audioDownloadUrl
}) {
  const supportAccount = process.env.SUPPORT_ACCOUNT || '@jxfr.in';
  const followAccount = process.env.FOLLOW_GATE_ACCOUNT || '@jxfr.in';

  let header = '';
  if (choiceType === 'video') {
    header = "🎬 Here's your video!";
  } else if (choiceType === 'audio') {
    header = "🎵 Here's your audio!";
  } else {
    header = "🎬🎵 Here's your video + audio!";
  }

  const cleanedCaption = caption ? caption.slice(0, 400) : 'Trending Reel';

  let linksBlock = '';
  if (choiceType === 'video') {
    linksBlock = `📥 Download HQ MP4: ${videoDownloadUrl}`;
  } else if (choiceType === 'audio') {
    linksBlock = `📥 Download MP3: ${audioDownloadUrl}`;
  } else {
    linksBlock = `📥 Download HQ MP4: ${videoDownloadUrl}
📥 Download MP3: ${audioDownloadUrl}`;
  }

  return `${header}

👤 ${creatorName}
📝 ${cleanedCaption}

🔥 Trending Audio

💡 Follow ${followAccount} to keep using this tool!
⚠️ Found a bug or error? Screenshot it and send to acc ${supportAccount}

${linksBlock}`;
}

/**
 * Checks whether the Instagram user follows the business account
 * Uses Meta Graph API field `is_user_follow_business`
 */
export async function checkUserFollowsBusiness(recipientId) {
  try {
    const token = getPageAccessToken();
    const response = await axios.get(`https://graph.facebook.com/${GRAPH_API_VERSION}/${recipientId}`, {
      params: {
        fields: 'name,username,is_user_follow_business',
        access_token: token
      },
      timeout: 10000
    });

    if (response.data && typeof response.data.is_user_follow_business === 'boolean') {
      return response.data.is_user_follow_business;
    }
    return null; // Undefined or not available
  } catch (err) {
    console.warn(`[Meta Messenger] Follow check notice: ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

/**
 * Builds the follow-gate lock prompt with interactive Quick Reply buttons
 */
export function buildFollowGatePrompt(botHandle = 'hqdownloaderbot') {
  const cleanHandle = botHandle.replace(/^@/, '');
  const text = `🔒 Download Locked!

To download this reel, please follow our page first:
👉 @${cleanHandle}
(https://instagram.com/${cleanHandle})

After following, tap the button below to unlock your download 👇`;

  const quickReplies = [
    { title: '✅ I Have Followed', payload: 'CHECK_FOLLOW' },
    { title: '🔄 Check Again', payload: 'CHECK_FOLLOW' }
  ];

  return { text, quickReplies };
}

