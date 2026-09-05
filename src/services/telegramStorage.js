import axios from 'axios';

/**
 * Service for using Telegram strictly as an invisible headless cloud storage bucket.
 * Files are uploaded to a private storage channel, never deleted, and user never sees Telegram.
 */

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables.');
  }
  return token;
}

function getStorageChannelId() {
  const channelId = process.env.TELEGRAM_STORAGE_CHANNEL_ID;
  if (!channelId) {
    throw new Error('TELEGRAM_STORAGE_CHANNEL_ID is not defined in environment variables.');
  }
  return channelId;
}

/**
 * Uploads a video to the private Telegram storage channel
 * Returns the Telegram file_id
 */
export async function uploadVideoToTelegram(videoUrl, caption = 'Stored Instagram Reel') {
  const token = getBotToken();
  const channelId = getStorageChannelId();

  console.log(`[Telegram Storage] Uploading video to storage channel ${channelId}...`);

  try {
    // Attempt direct URL transfer first (Fastest, zero server RAM usage)
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, {
      chat_id: channelId,
      video: videoUrl,
      caption: caption.slice(0, 1000),
      supports_streaming: true
    }, {
      timeout: 30000
    });

    if (response.data?.ok) {
      const fileId = response.data.result.video?.file_id || 
                     response.data.result.document?.file_id;
      if (fileId) {
        console.log(`[Telegram Storage] Video uploaded successfully. file_id: ${fileId}`);
        return fileId;
      }
    }
  } catch (err) {
    console.warn(`[Telegram Storage] Direct URL video upload failed: ${err.response?.data?.description || err.message}. Attempting stream buffer fallback...`);
  }

  // Fallback: Buffer download and multipart upload
  try {
    const videoStream = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 45000
    });

    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('caption', caption.slice(0, 1000));
    formData.append('supports_streaming', 'true');
    const blob = new Blob([videoStream.data], { type: 'video/mp4' });
    formData.append('video', blob, 'reel.mp4');

    const response = await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });

    if (response.data?.ok) {
      const fileId = response.data.result.video?.file_id || 
                     response.data.result.document?.file_id;
      if (fileId) {
        console.log(`[Telegram Storage] Stream upload succeeded. file_id: ${fileId}`);
        return fileId;
      }
    }
  } catch (bufferErr) {
    console.error(`[Telegram Storage] Stream upload also failed: ${bufferErr.message}`);
    throw new Error(`Failed to upload video to Telegram storage: ${bufferErr.message}`);
  }

  throw new Error('Telegram Bot API returned unexpected response when uploading video.');
}

/**
 * Uploads an audio track to the private Telegram storage channel
 * Returns the Telegram file_id
 */
export async function uploadAudioToTelegram(audioUrl, title = 'Reel Audio', performer = 'Instagram Creator') {
  const token = getBotToken();
  const channelId = getStorageChannelId();

  console.log(`[Telegram Storage] Uploading audio to storage channel ${channelId}...`);

  try {
    // Attempt direct URL upload
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendAudio`, {
      chat_id: channelId,
      audio: audioUrl,
      title: title.slice(0, 100),
      performer: performer.slice(0, 100)
    }, {
      timeout: 30000
    });

    if (response.data?.ok) {
      const fileId = response.data.result.audio?.file_id || 
                     response.data.result.document?.file_id;
      if (fileId) {
        console.log(`[Telegram Storage] Audio uploaded successfully. file_id: ${fileId}`);
        return fileId;
      }
    }
  } catch (err) {
    console.warn(`[Telegram Storage] Direct audio upload failed: ${err.response?.data?.description || err.message}. Attempting stream buffer fallback...`);
  }

  // Fallback: Buffer download and multipart upload
  try {
    const audioStream = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 30000
    });

    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('title', title.slice(0, 100));
    formData.append('performer', performer.slice(0, 100));
    const blob = new Blob([audioStream.data], { type: 'audio/mp4' });
    formData.append('audio', blob, 'audio.m4a');

    const response = await axios.post(`https://api.telegram.org/bot${token}/sendAudio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000
    });

    if (response.data?.ok) {
      const fileId = response.data.result.audio?.file_id || 
                     response.data.result.document?.file_id;
      if (fileId) {
        console.log(`[Telegram Storage] Audio stream upload succeeded. file_id: ${fileId}`);
        return fileId;
      }
    }
  } catch (bufferErr) {
    console.error(`[Telegram Storage] Audio stream upload failed: ${bufferErr.message}`);
    throw new Error(`Failed to upload audio to Telegram storage: ${bufferErr.message}`);
  }

  throw new Error('Telegram Bot API returned unexpected response when uploading audio.');
}

/**
 * Resolves the Telegram direct CDN URL for a file_id
 * Returns: https://api.telegram.org/file/bot<TOKEN>/<file_path>
 */
export async function getDirectTelegramFileUrl(fileId) {
  const token = getBotToken();

  const response = await axios.get(`https://api.telegram.org/bot${token}/getFile`, {
    params: { file_id: fileId },
    timeout: 10000
  });

  if (!response.data?.ok || !response.data?.result?.file_path) {
    throw new Error(`Telegram getFile failed: ${response.data?.description || 'File not found or expired on Telegram CDN'}`);
  }

  const filePath = response.data.result.file_path;
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
