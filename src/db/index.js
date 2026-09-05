import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

let pool = null;
let isPostgres = false;

// Local fallback store (for development without Postgres)
const LOCAL_DB_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, 'db.json');

let localDbCache = {
  downloads: {},
  user_sessions: {}
};

let isLoaded = false;

function ensureLocalDbFile() {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
  }
  if (!isLoaded) {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      try {
        const content = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        localDbCache.downloads = parsed.downloads || {};
        localDbCache.user_sessions = parsed.user_sessions || {};
      } catch {
        localDbCache = { downloads: {}, user_sessions: {} };
      }
    } else {
      fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDbCache, null, 2), 'utf-8');
    }
    isLoaded = true;
  }
}

function persistLocalDb() {
  try {
    ensureLocalDbFile();
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to persist local DB file:', err.message);
  }
}

/**
 * Initialize Database connection and schema
 */
export async function initDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    isPostgres = true;
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' || databaseUrl.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : false,
      max: 10,
      idleTimeoutMillis: 30000
    });

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS downloads (
          id VARCHAR(64) PRIMARY KEY,
          file_id TEXT NOT NULL,
          media_type VARCHAR(16) NOT NULL DEFAULT 'video',
          creator_name TEXT,
          caption TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
          sender_id VARCHAR(128) PRIMARY KEY,
          video_slug VARCHAR(64),
          audio_slug VARCHAR(64),
          video_file_id TEXT,
          audio_file_id TEXT,
          creator_name TEXT,
          caption TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );
      `);
      console.log('[DB] Connected to PostgreSQL and initialized tables.');
    } finally {
      client.release();
    }
  } else {
    isPostgres = false;
    ensureLocalDbFile();
    console.log('[DB] Running with local persistent file store (data/db.json).');
  }
}

/**
 * Create a new expiring download record
 */
export async function createDownloadRecord({
  id,
  fileId,
  mediaType = 'video',
  creatorName = '',
  caption = '',
  createdAt = new Date(),
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
}) {
  const cAt = new Date(createdAt).toISOString();
  const eAt = new Date(expiresAt).toISOString();

  if (isPostgres && pool) {
    const query = `
      INSERT INTO downloads (id, file_id, media_type, creator_name, caption, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        file_id = EXCLUDED.file_id,
        media_type = EXCLUDED.media_type,
        creator_name = EXCLUDED.creator_name,
        caption = EXCLUDED.caption,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at
      RETURNING *;
    `;
    const res = await pool.query(query, [id, fileId, mediaType, creatorName, caption, cAt, eAt]);
    return res.rows[0];
  }

  // Local fallback
  localDbCache.downloads[id] = {
    id,
    file_id: fileId,
    media_type: mediaType,
    creator_name: creatorName,
    caption,
    created_at: cAt,
    expires_at: eAt
  };
  persistLocalDb();
  return localDbCache.downloads[id];
}

/**
 * Get download record by slug ID
 */
export async function getDownloadRecord(id) {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM downloads WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  ensureLocalDbFile();
  return localDbCache.downloads[id] || null;
}

/**
 * Save user session (active reel awaiting user quick-reply choice)
 */
export async function saveUserSession(senderId, sessionData) {
  const createdAt = new Date().toISOString();
  const data = {
    sender_id: senderId,
    video_slug: sessionData.videoSlug || null,
    audio_slug: sessionData.audioSlug || null,
    video_file_id: sessionData.videoFileId || null,
    audio_file_id: sessionData.audioFileId || null,
    creator_name: sessionData.creatorName || '',
    caption: sessionData.caption || '',
    created_at: createdAt
  };

  if (isPostgres && pool) {
    const query = `
      INSERT INTO user_sessions (sender_id, video_slug, audio_slug, video_file_id, audio_file_id, creator_name, caption, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (sender_id) DO UPDATE SET
        video_slug = EXCLUDED.video_slug,
        audio_slug = EXCLUDED.audio_slug,
        video_file_id = EXCLUDED.video_file_id,
        audio_file_id = EXCLUDED.audio_file_id,
        creator_name = EXCLUDED.creator_name,
        caption = EXCLUDED.caption,
        created_at = EXCLUDED.created_at
      RETURNING *;
    `;
    const res = await pool.query(query, [
      data.sender_id,
      data.video_slug,
      data.audio_slug,
      data.video_file_id,
      data.audio_file_id,
      data.creator_name,
      data.caption,
      data.created_at
    ]);
    return res.rows[0];
  }

  // Local fallback
  localDbCache.user_sessions[senderId] = data;
  persistLocalDb();
  return data;
}

/**
 * Get latest active session for an Instagram user
 */
export async function getUserSession(senderId) {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM user_sessions WHERE sender_id = $1', [senderId]);
    return res.rows[0] || null;
  }

  ensureLocalDbFile();
  return localDbCache.user_sessions[senderId] || null;
}
