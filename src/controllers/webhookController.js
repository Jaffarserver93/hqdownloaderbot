import { nanoid } from 'nanoid';
import {
  findInstagramUrlInText,
  extractInstagramUrlFromMessage,
  extractInstagramMedia
} from '../services/instagramExtractor.js';
import {
  uploadVideoToTelegram,
  uploadAudioToTelegram,
  getDirectTelegramFileUrl
} from '../services/telegramStorage.js';
import {
  createDownloadRecord,
  saveUserSession,
  getUserSession
} from '../db/index.js';
import {
  sendInstagramTextMessage,
  sendInstagramQuickReplies,
  sendInstagramMediaAttachment,
  buildGreetingQuickReplies,
  buildDeliveryCaption,
  checkUserFollowsBusiness,
  buildFollowGatePrompt
} from '../services/metaMessenger.js';

/**
 * Handles Meta Webhook verification (GET /webhook)
 */
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'hqdownloader_verify_secret_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Webhook] Webhook verified successfully by Meta.');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed. Token mismatch or invalid mode.');
  return res.status(403).send('Verification token mismatch.');
}

/**
 * Handles incoming Instagram messages and Quick Replies (POST /webhook)
 */
export async function handleWebhookEvent(req, res) {
  const body = req.body;
  console.log('[Webhook Incoming]', JSON.stringify(body));

  if (!body || (body.object !== 'instagram' && body.object !== 'page')) {
    return res.status(200).send('EVENT_IGNORED');
  }

  const entries = body.entry || [];
  for (const entry of entries) {
    // 1. Check standard messaging list
    const messagingList = entry.messaging || [];
    for (const event of messagingList) {
      const senderId = event.sender?.id;
      if (!senderId) continue;

      try {
        await processMessagingEvent(senderId, event);
      } catch (err) {
        console.error(`[Webhook] Error processing event for user ${senderId}:`, err.message);
      }
    }

    // 2. Check changes list (Instagram Webhook field format)
    const changesList = entry.changes || [];
    for (const change of changesList) {
      if (change.field === 'messages' && change.value) {
        const val = change.value;
        const senderId = val.sender?.id || val.from?.id;
        if (!senderId) continue;

        try {
          await processMessagingEvent(senderId, {
            message: val.message || val,
            sender: { id: senderId }
          });
        } catch (err) {
          console.error(`[Webhook] Error processing change event for user ${senderId}:`, err.message);
        }
      }
    }
  }

  // Acknowledge AFTER processing finishes so Vercel does not terminate lambda execution prematurely
  return res.status(200).send('EVENT_RECEIVED');
}

/**
 * Dispatches an event based on whether it is a Quick Reply, Option 1/2/3, Follow-Gate check, or an Instagram link
 */
async function processMessagingEvent(senderId, event) {
  const message = event.message;
  if (!message) return;

  const quickReplyPayload = message.quick_reply?.payload;
  const rawText = message.text ? message.text.trim() : '';

  // 1. Check if user tapped "I Have Followed" or requested follow check
  if (quickReplyPayload === 'CHECK_FOLLOW' || /^(followed|check|unlocked|done)$/i.test(rawText)) {
    await handleFollowCheck(senderId);
    return;
  }

  // 2. Check if user clicked a Quick Reply button OR typed 1, 2, or 3
  const choice = detectUserChoice(quickReplyPayload, rawText);
  if (choice) {
    await handleUserOptionChoice(senderId, choice);
    return;
  }

  // 3. Check if user sent an Instagram Reel or Post link (text or shared attachment)
  const instagramUrl = extractInstagramUrlFromMessage(message);
  if (instagramUrl) {
    await handleIncomingInstagramLink(senderId, instagramUrl);
    return;
  }

  // 4. Fallback / Greeting for non-link messages
  await sendInstagramTextMessage(
    senderId,
    "👋 Welcome! Send me any Instagram Reel or Post link, and I'll extract the video & audio for you instantly!"
  );
}

/**
 * Detects whether the input corresponds to Option 1 (video), 2 (audio), or 3 (both)
 */
function detectUserChoice(payload, text) {
  if (payload === 'ACTION_VIDEO' || /^(1|video|🎬)$/i.test(text)) return 'video';
  if (payload === 'ACTION_AUDIO' || /^(2|audio|mp3|voice|🎵)$/i.test(text)) return 'audio';
  if (payload === 'ACTION_BOTH' || /^(3|both|all|📦)$/i.test(text)) return 'both';
  return null;
}

/**
 * Handles incoming Instagram URL: extracts, stores in Telegram, generates 24h slugs, handles follow gate
 */
async function handleIncomingInstagramLink(senderId, url) {
  console.log(`[Webhook] Processing reel from ${senderId}: ${url}`);

  // Send a quick acknowledgment so user knows it's being processed
  await sendInstagramTextMessage(senderId, "⏳ Fetching and processing your reel...");

  // 1. Extract Instagram Media & Metadata
  const media = await extractInstagramMedia(url);

  // 2. Upload video and audio to invisible Telegram storage bucket
  const videoFileId = await uploadVideoToTelegram(media.videoUrl, `Reel by @${media.creatorName}: ${url}`);
  const audioFileId = await uploadAudioToTelegram(media.audioUrl, media.caption, media.creatorName);

  // 3. Generate unique random IDs / slugs with 24-hour expiration
  const videoSlug = nanoid(8);
  const audioSlug = nanoid(8);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Store in database
  await createDownloadRecord({
    id: videoSlug,
    fileId: videoFileId,
    mediaType: 'video',
    creatorName: media.creatorName,
    caption: media.caption,
    createdAt: now,
    expiresAt
  });

  await createDownloadRecord({
    id: audioSlug,
    fileId: audioFileId,
    mediaType: 'audio',
    creatorName: media.creatorName,
    caption: media.caption,
    createdAt: now,
    expiresAt
  });

  // Save session state for this user
  await saveUserSession(senderId, {
    videoSlug,
    audioSlug,
    videoFileId,
    audioFileId,
    creatorName: media.creatorName,
    caption: media.caption
  });

  // 4. Follow-Gate Check: Check if user follows the bot account
  const followGateAccount = process.env.FOLLOW_GATE_ACCOUNT || 'hqdownloaderbot';
  const isFollowing = await checkUserFollowsBusiness(senderId);

  // If user does NOT follow, lock and prompt them to follow
  if (isFollowing === false) {
    console.log(`[FollowGate] User ${senderId} does not follow @${followGateAccount}. Sending follow lock prompt.`);
    const { text, quickReplies } = buildFollowGatePrompt(followGateAccount);
    await sendInstagramQuickReplies(senderId, text, quickReplies);
    return;
  }

  // User follows (or API query succeeded with true/neutral): Send download options menu
  const { text, quickReplies } = buildGreetingQuickReplies();
  await sendInstagramQuickReplies(senderId, text, quickReplies);
}

/**
 * Handles user tapping "✅ I Have Followed"
 */
async function handleFollowCheck(senderId) {
  const session = await getUserSession(senderId);
  if (!session || (!session.video_slug && !session.audio_slug)) {
    await sendInstagramTextMessage(
      senderId,
      "⚠️ No pending reel found. Please send an Instagram Reel or Post link first!"
    );
    return;
  }

  const followGateAccount = process.env.FOLLOW_GATE_ACCOUNT || 'hqdownloaderbot';
  const cleanAccount = followGateAccount.replace(/^@/, '');
  const isFollowing = await checkUserFollowsBusiness(senderId);

  if (isFollowing === false) {
    await sendInstagramTextMessage(
      senderId,
      `⚠️ It looks like you haven't followed @${cleanAccount} yet!\n\nPlease tap follow: https://instagram.com/${cleanAccount}\nThen tap "I Have Followed" again to unlock.`
    );
    const { text, quickReplies } = buildFollowGatePrompt(followGateAccount);
    await sendInstagramQuickReplies(senderId, text, quickReplies);
    return;
  }

  // Unlocked!
  await sendInstagramTextMessage(
    senderId,
    `🎉 Thank you for following @${cleanAccount}! Your download is now unlocked.`
  );

  const { text, quickReplies } = buildGreetingQuickReplies();
  await sendInstagramQuickReplies(senderId, text, quickReplies);
}

/**
 * Delivers the requested media (video, audio, or both) and formatted caption
 */
async function handleUserOptionChoice(senderId, choice) {
  const session = await getUserSession(senderId);
  if (!session || (!session.video_slug && !session.audio_slug)) {
    await sendInstagramTextMessage(
      senderId,
      "⚠️ No pending reel found. Please send a new Instagram Reel link first!"
    );
    return;
  }

  const baseUrl = (process.env.BASE_URL || 'https://hqdownloaderbot.vercel.app').replace(/\/$/, '');
  const videoDownloadUrl = `${baseUrl}/dl/${session.video_slug}`;
  const audioDownloadUrl = `${baseUrl}/dl/${session.audio_slug}`;

  // 1. Try sending direct media attachments into DM
  if (choice === 'video' || choice === 'both') {
    try {
      const directVideoUrl = await getDirectTelegramFileUrl(session.video_file_id);
      await sendInstagramMediaAttachment(senderId, 'video', directVideoUrl);
    } catch (e) {
      console.warn('[Webhook] Direct video attachment send failed, proceeding with links:', e.message);
    }
  }

  if (choice === 'audio' || choice === 'both') {
    try {
      const directAudioUrl = await getDirectTelegramFileUrl(session.audio_file_id);
      await sendInstagramMediaAttachment(senderId, 'audio', directAudioUrl);
    } catch (e) {
      console.warn('[Webhook] Direct audio attachment send failed, proceeding with links:', e.message);
    }
  }

  // 2. Build and deliver the rich caption with creator name, caption, bug prompt, and expiring links
  const captionMessage = buildDeliveryCaption({
    choiceType: choice,
    creatorName: session.creator_name || 'Creator',
    caption: session.caption,
    videoDownloadUrl,
    audioDownloadUrl
  });

  await sendInstagramTextMessage(senderId, captionMessage);
}
