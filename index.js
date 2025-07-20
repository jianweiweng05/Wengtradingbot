// =================================================================
// 1. 核心配置
// =================================================================
const IS_PAPER_TRADING_MODE = true;
const TRADINGVIEW_WEBHOOK_PATH = '/tradingview-webhook';
const AUTHORIZED_USERS = [process.env.TELEGRAM_CHAT_ID];

// =================================================================
// 2. 导入与初始化
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const os = require('os');

const app = express();
app.use(express.json());

const {
  SUPABASE_URL, SUPABASE_KEY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  PORT
} = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("FATAL ERROR: Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// =================================================================
// 3. 核心功能模块
// =================================================================

function isAuthorized(chatId) {
  return AUTHORIZED_USERS.includes(chatId.toString());
}

async function sendTelegramMessage(chatId, message, options = {}) {
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
  } catch (error) {
    console.error(`Error sending Telegram message:`, error.message);
  }
}

async function testSupabaseConnection() {
  console.log('[INFO] Testing connection to Supabase...');
  try {
    const { error } = await supabase.from('macro_state').select('id').limit(1);
    if (error) throw error;
    console.log('[INFO] ✅ Supabase connection test successful.');
    return true;
  } catch (error) {
    console.error('[ERROR] 🚨 Supabase connection test FAILED:', error.message);
    return false;
  }
}

async function getSystemStatusReport(startTime) {
    const { data: rows, error: dbError } = await supabase.from('macro_state').select('*').order('id', { ascending: false }).limit(1);
    if (dbError || !rows || !rows.length) throw new Error('Could not fetch macro state');

    const macroState = rows[0];
    const { count: paperCount } = await supabase.from('paper_trades').select('*', { count: 'exact', head: true });
    const { count: liveCount } = await supabase.from('positions').select('*', { count: 'exact', head: true });

    let stateDetail = 'No clear direction';
    if (macroState.market_state === 'BULL') {
      if (macroState.btc_state === 'LONG' && macroState.eth_state === 'LONG') stateDetail = 'Dual Bull (BTC & ETH)';
      // ... other bull states
    } else if (macroState.market_state === 'BEAR') {
      if (macroState.btc_state === 'SHORT' && macroState.eth_state === 'SHORT') stateDetail = 'Dual Bear (BTC & ETH)';
      // ... other bear states
    }

    const lastSignalTimeInfo = '(No record)';
    // ... logic to calculate last signal time

    const queryTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return `
*--- System Status (V33 Stable) ---*
- **Market State**: \`${macroState.market_state || 'NEUTRAL'}\`
- **State Detail**: \`${stateDetail}\`
- **Manual Override**: \`${macroState.manual_override ? 'ON (Paused)' : 'OFF (Running)'}\`
- **Paper Trades**: \`${paperCount || 0}\`
- **Operating Mode**: \`${IS_PAPER_TRADING_MODE ? 'Paper Trading' : 'Live'}\`
- (Query Time: ${queryTime}s)
    `.trim();
}


// =================================================================
// 4. Telegram Command Handlers
// =================================================================
bot.on('message', async (msg) => {
    if (!msg.text || !msg.text.startsWith('/') || !isAuthorized(msg.chat.id)) {
        if (!isAuthorized(msg.chat.id)) await sendTelegramMessage(msg.chat.id, '⛔️ **Unauthorized**');
        return;
    }

    const command = msg.text.split(' ')[0];
    const chatId = msg.chat.id;

    switch (command) {
        case '/start':
        case '/help':
            const helpText = `*Available Commands (V33)*:\n\`/status\` - Get system status.\n\`/test\` - Test bot responsiveness.`;
            await sendTelegramMessage(chatId, helpText);
            break;

        case '/test':
            await sendTelegramMessage(chatId, '✅ Bot is online.');
            break;

        case '/status':
            let waitMsg;
            try {
                waitMsg = await bot.sendMessage(chatId, "⏳ `Generating status report...`", { parse_mode: 'Markdown'});
                const report = await getSystemStatusReport(Date.now());
                await bot.editMessageText(report, { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' });
            } catch (error) {
                const errorMsg = `❌ **Status Report Failed**\nReason: ${error.message}`;
                if (waitMsg) await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' });
                else await sendTelegramMessage(chatId, errorMsg);
            }
            break;
    }
});


// =================================================================
// 5. Routes & Server Start
// =================================================================
app.get('/healthz', (req, res) => res.status(200).send('OK'));
const port = PORT || 10000;

app.listen(port, async () => {
  console.log(`[INFO] V33 Final Stable Engine is starting on port ${port}...`);

  const isReady = await testSupabaseConnection();

  if (isReady) {
    const startMessage = `✅ **V33 Final Stable Engine Started**\n- **Mode**: ${IS_PAPER_TRADING_MODE ? 'Paper Trading' : 'Live'}`;
    await sendTelegramMessage(TELEGRAM_CHAT_ID, startMessage);
    console.log(`[INFO] ✅ V33 is now fully operational.`);
  } else {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `❌ **V33 Engine Start Failed** ❌`);
  }
});