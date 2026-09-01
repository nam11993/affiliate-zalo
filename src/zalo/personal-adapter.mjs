import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MessageRouter } from '../messaging/router.mjs';
import { resolveAndClassifyShopeeUrl } from '../shopee/classifier.mjs';
import { buildZcaMention, isSupportedZcaMessage, normalizeZcaMessage } from './zca-normalize.mjs';

function parseCsv(value = '') {
  return String(value)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function boolEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function intEnv(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function readZaloRuntimeConfig(env = process.env) {
  return {
    replyEnabled: boolEnv(env.ZALO_REPLY_ENABLED, false),
    listenDirect: boolEnv(env.ZALO_LISTEN_DIRECT, false),
    classifyShopeeLinks: boolEnv(env.ZALO_CLASSIFY_SHOPEE_LINKS, true),
    allowedGroupIds: parseCsv(env.ZALO_ALLOWED_GROUP_IDS),
    autoLockFirstGroup: boolEnv(env.ZALO_AUTO_LOCK_FIRST_GROUP, false),
    openQrAutomatically: boolEnv(env.ZALO_OPEN_QR_AUTOMATICALLY, true),
    replyCooldownMs: intEnv(env.ZALO_REPLY_COOLDOWN_MS, 3000),
    verboseRaw: boolEnv(env.ZALO_VERBOSE_RAW, false),
    debugEvents: boolEnv(env.ZALO_DEBUG_EVENTS, true),
    selfListen: boolEnv(env.ZALO_SELF_LISTEN, false),
    envFilePath: env.ZALO_ENV_FILE_PATH || path.resolve(process.cwd(), '.env')
  };
}

function displayMessageLog(normalized, routeResult, { verboseRaw = false } = {}) {
  const line = '─'.repeat(70);
  console.log(`\n${line}`);
  console.log('📨 ZALO GROUP MESSAGE');
  console.log(`Group ID : ${normalized.groupId || '(unknown)'}`);
  console.log(`Sender   : ${normalized.senderName || '(unknown)'} (${normalized.senderId || '?'})`);
  console.log(`MessageID: ${normalized.messageId || '(unknown)'}`);
  console.log(`Text     : ${normalized.text}`);
  if (routeResult?.parsed) {
    console.log(`Intent   : ${routeResult.parsed.type}${routeResult.parsed.command ? ` / #${routeResult.parsed.command}` : ''}`);
  }
  if (routeResult?.data?.linkType) {
    console.log(`Link type: ${routeResult.data.linkType}`);
  }
  if (routeResult?.data?.resolvedUrl) {
    console.log(`Resolved : ${routeResult.data.resolvedUrl}`);
  }
  console.log(`Action   : ${routeResult?.action || 'NO_REPLY'}${routeResult?.reason ? ` (${routeResult.reason})` : ''}`);
  if (routeResult?.reply?.text) {
    console.log('\n🤖 REPLY CONTENT:');
    console.log(routeResult.reply.text);
  }
  if (verboseRaw) {
    console.log('\nRAW:');
    console.dir(normalized.raw, { depth: 6 });
  }
  console.log(line);
}

class Cooldown {
  constructor(ms = 3000) {
    this.ms = ms;
    this.last = new Map();
  }

  canSend(key) {
    const now = Date.now();
    const previous = this.last.get(key) ?? 0;
    if (now - previous < this.ms) return false;
    this.last.set(key, now);
    return true;
  }
}

function upsertEnvValue(filePath, key, value) {
  try {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const lines = content.split(/\r?\n/);
    const prefix = `${key}=`;
    let found = false;
    const next = lines.map(line => {
      if (line.startsWith(prefix)) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });
    if (!found) next.push(`${key}=${value}`);
    fs.writeFileSync(filePath, next.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
  } catch (error) {
    console.warn(`⚠️ Không thể lưu ${key} vào .env: ${error?.message || error}`);
  }
}

function openFileDefault(filePath) {
  const absolute = path.resolve(filePath);
  try {
    let command;
    let args;
    if (process.platform === 'win32') {
      command = 'cmd.exe';
      args = ['/c', 'start', '', absolute];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [absolute];
    } else {
      command = 'xdg-open';
      args = [absolute];
    }
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function watchAndOpenQr(qrPath, { enabled = true, timeoutMs = 120000 } = {}) {
  if (!enabled) return () => {};

  const startedAt = Date.now();
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    if (Date.now() - startedAt > timeoutMs) {
      clearInterval(timer);
      return;
    }
    try {
      const stat = fs.statSync(qrPath);
      if (stat.size <= 0) return;
      clearInterval(timer);
      stopped = true;
      console.log(`\n🖼️ QR đã tạo: ${qrPath}`);
      const opened = openFileDefault(qrPath);
      console.log(opened
        ? '✅ Đã tự mở ảnh QR. Hãy quét bằng Zalo trên điện thoại.'
        : 'ℹ️ Không tự mở được QR; hãy mở file qr.png trong thư mục project.');
    } catch {
      // File chưa có, tiếp tục chờ.
    }
  }, 250);
  timer.unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * Start the unofficial personal-Zalo listener using zca-js.
 * Supports read-only and reply modes. In reply mode, an empty allowlist can
 * optionally auto-lock to the first group that sends a message.
 */
export async function startPersonalZaloListener({ env = process.env } = {}) {
  const config = readZaloRuntimeConfig(env);

  if (config.replyEnabled && config.allowedGroupIds.length === 0 && !config.autoLockFirstGroup) {
    throw new Error('Reply đang bật nhưng chưa có ZALO_ALLOWED_GROUP_IDS. Hãy điền Group ID hoặc bật ZALO_AUTO_LOCK_FIRST_GROUP=true.');
  }

  let zca;
  try {
    zca = await import('zca-js');
  } catch (error) {
    throw new Error('Chưa cài zca-js. Chạy `npm install` trong thư mục project trước.', { cause: error });
  }

  const { Zalo, ThreadType } = zca;
  const zalo = new Zalo({ selfListen: config.selfListen });

  console.log('⚠️  zca-js là API Zalo cá nhân KHÔNG chính thức.');
  console.log('🔐 Không nhập mật khẩu vào code. Hãy quét QR bằng ứng dụng Zalo trên điện thoại.');
  console.log('🌐 Trong lúc listener chạy, không mở Zalo Web cùng tài khoản.');
  console.log(`🛡️  Mode: ${config.replyEnabled ? 'REPLY ENABLED' : 'READ ONLY'}`);
  if (config.allowedGroupIds.length) {
    console.log(`✅ Group allowlist: ${config.allowedGroupIds.join(', ')}`);
  } else if (config.replyEnabled && config.autoLockFirstGroup) {
    console.log('🔒 Chưa có Group ID: bot sẽ TỰ KHÓA vào group đầu tiên gửi tin nhắn và lưu ID vào .env.');
    console.log('👉 Vì vậy hãy gửi tin nhắn đầu tiên từ đúng GROUP TEST của bạn.');
  } else {
    console.log('ℹ️  Chưa có group allowlist: read-only sẽ log các group để bạn lấy Group ID.');
  }
  console.log('\n📱 Đang tạo QR đăng nhập...\n');

  const qrPath = path.resolve(process.cwd(), 'qr.png');
  try { fs.rmSync(qrPath, { force: true }); } catch {}
  const stopQrWatcher = watchAndOpenQr(qrPath, { enabled: config.openQrAutomatically });

  let api;
  try {
    api = await zalo.loginQR();
  } finally {
    stopQrWatcher();
  }

  const router = new MessageRouter({
    allowedGroupIds: config.allowedGroupIds,
    classifyLink: config.classifyShopeeLinks ? resolveAndClassifyShopeeUrl : null
  });
  const cooldown = new Cooldown(config.replyCooldownMs);
  let autoLockedGroupId = config.allowedGroupIds[0] || null;

  api.listener.on('connected', () => {
    console.log('\n✅ Zalo listener đã kết nối.');
    console.log(config.replyEnabled
      ? '🤖 BOT REPLY đang bật. Hãy gửi link Shopee vào group test.'
      : '👂 READ ONLY đang bật. Hãy gửi tin nhắn vào group test.');
  });

  api.listener.on('message', async (message) => {
    try {
      if (config.debugEvents) {
        console.log('\n[ZALO EVENT] message received');
        console.log(`  type=${message?.type} threadId=${message?.threadId || ''} isSelf=${Boolean(message?.isSelf)} msgType=${message?.data?.msgType || ''} contentType=${typeof message?.data?.content}`);
        if (typeof message?.data?.content === 'string') {
          console.log(`  content=${message.data.content}`);
        } else if (message?.data?.content && typeof message.data.content === 'object') {
          const href = message.data.content.href || message.data.content.url || message.data.content.link || message.data.content.oriUrl || message.data.content.normalUrl || '';
          console.log(`  linkPayload=${href || '(object; no top-level href)'}`);
        }
      }

      // Mặc định không xử lý tin do chính account bot gửi để tránh vòng lặp.
      if (message?.isSelf) {
        if (config.debugEvents) console.log('  -> ignored: SELF_MESSAGE');
        return;
      }
      if (!isSupportedZcaMessage(message)) {
        if (config.debugEvents) {
          console.log('  -> ignored: UNSUPPORTED_CONTENT');
          if (message?.data?.content && typeof message.data.content === 'object') {
            console.dir(message.data.content, { depth: 4 });
          }
        }
        return;
      }
      if (message.type === ThreadType.User && !config.listenDirect) return;
      if (message.type !== ThreadType.Group && message.type !== ThreadType.User) return;

      const normalized = normalizeZcaMessage(message);
      if (!normalized.text) return;

      if (
        config.replyEnabled &&
        config.autoLockFirstGroup &&
        message.type === ThreadType.Group &&
        !autoLockedGroupId &&
        normalized.groupId
      ) {
        autoLockedGroupId = String(normalized.groupId);
        router.allowedGroupIds.add(autoLockedGroupId);
        process.env.ZALO_ALLOWED_GROUP_IDS = autoLockedGroupId;
        upsertEnvValue(config.envFilePath, 'ZALO_ALLOWED_GROUP_IDS', autoLockedGroupId);
        console.log(`\n🔒 Đã tự khóa bot vào Group ID: ${autoLockedGroupId}`);
        console.log('✅ Group ID đã được lưu vào .env. Các group khác sẽ bị bỏ qua.');
      }

      const routeResult = await router.route(normalized);
      displayMessageLog(normalized, routeResult, config);

      if (!config.replyEnabled) return;
      if (message.type !== ThreadType.Group) return;
      if (routeResult.action !== 'REPLY' || !routeResult.reply?.text) return;

      const throttleKey = `${normalized.groupId}:${normalized.senderId}`;
      if (!cooldown.canSend(throttleKey)) {
        console.log(`⏳ Bỏ qua reply do cooldown ${config.replyCooldownMs}ms.`);
        return;
      }

      const mentions = buildZcaMention({
        text: routeResult.reply.text,
        senderId: normalized.senderId,
        senderName: normalized.senderName
      });

      // zca-js docs use the inbound Message object itself for quote.
      await api.sendMessage(
        {
          msg: routeResult.reply.text,
          quote: message.data,
          ...(mentions.length ? { mentions } : {})
        },
        normalized.groupId || message.threadId,
        ThreadType.Group
      );

      console.log('✅ Đã gửi reply vào group.');
    } catch (error) {
      console.error('❌ Lỗi xử lý message:', error?.stack || error?.message || error);
    }
  });

  api.listener.on('error', error => {
    console.error('❌ Zalo listener error:', error?.message || error);
  });

  await api.listener.start();
  return { api, config, router };
}
