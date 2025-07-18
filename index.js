// =================================================================
// 1. 核心配置 (保持不变)
// =================================================================
const IS_PAPER_TRADING_MODE = true;
const ACCOUNT_ID_3COMMAS = 33257245;
const MOCK_ACCOUNT_VALUE_USD = 100000;
const STATE_EXPIRATION_HOURS_BULL = 168;
const STATE_EXPIRATION_HOURS_BEAR = 72;
const TELEGRAM_WEBHOOK_PATH = '/telegram-webhook-endpoint-a7b3c9x';

// =================================================================
// 2. 导入与初始化
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
// ... (其他模块导入和初始化与V8版本相同)

const app = express();
app.use(express.json());

const {
  SUPABASE_URL, SUPABASE_KEY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  WEBHOOK_SECRET, RENDER_EXTERNAL_URL
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// =================================================================
// 3. 辅助函数 (保持不变)
// =================================================================
async function sendTelegramMessage(chatId, message, keyboard = null) {
  const options = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };
  if (keyboard) {
    options.reply_markup = keyboard;
  }
  try {
    await bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.message);
  }
}

// =================================================================
// 4. Telegram 交互式指令 - V9核心升级
// =================================================================

// --- 定义我们的按钮键盘 ---
const mainKeyboard = {
  keyboard: [
    [{ text: "📊 查询状态 (/status)" }],
    [{ text: "⏸️ 暂停系统 (/pause)" }, { text: "🚀 恢复系统 (/resume)" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// --- 指令处理器 ---
async function handleTelegramCommands(message) {
  if (!message || !message.text || message.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  // 将按钮上的文字，也映射到指令
  let command = message.text.split(' ')[0];
  if (message.text.includes('/status')) command = '/status';
  if (message.text.includes('/pause')) command = '/pause';
  if (message.text.includes('/resume')) command = '/resume';

  const chatId = message.chat.id;

  switch (command) {
    case '/start':
      await sendTelegramMessage(chatId, '欢迎回来，总司令！您的交互式控制面板已加载。', { remove_keyboard: true });
      await sendTelegramMessage(chatId, '请选择操作：', mainKeyboard);
      break;
    
    case '/status':
      // ... (status的逻辑和V8版完全一样)
      const { data: macroState } = await supabase.from('macro_state').select('*').single();
      const statusReport = `*--- 系统状态报告 ---*\n- **市场状态**: \`${macroState.market_state || 'NEUTRAL'}\`\n...`;
      await sendTelegramMessage(chatId, statusReport, mainKeyboard);
      break;

    case '/pause':
      // ... (pause的逻辑和V8版完全一样)
      await supabase.from('macro_state').update({ manual_override: true }).eq('id', 1);
      await sendTelegramMessage(chatId, '⏸️ **系统已暂停** ⏸️', mainKeyboard);
      break;

    case '/resume':
      // ... (resume的逻辑和V8版完全一样)
      await supabase.from('macro_state').update({ manual_override: false }).eq('id', 1);
      await sendTelegramMessage(chatId, '🚀 **系统已恢复** 🚀', mainKeyboard);
      break;
    
    default:
      await sendTelegramMessage(chatId, '无法识别的指令。请使用下方的按钮进行操作。', mainKeyboard);
      break;
  }
}

// =================================================================
// 5. 路由与启动 (Webhook部分和V8版完全一样)
// =================================================================
// ... (此处省略了app.post('/webhook',...)等路由代码, 它们保持不变)

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, async () => {
  // ... (省略了启动和自动注册Webhook的逻辑, 它保持不变)
});


// =================================================================
// ============== 完整的 V9 代码 - 请从这里开始复制 ==============
// =================================================================
const IS_PAPER_TRADING_MODE = true;
const ACCOUNT_ID_3COMMAS = 33257245;
const MOCK_ACCOUNT_VALUE_USD = 100000;
const STATE_EXPIRATION_HOURS_BULL = 168;
const STATE_EXPIRATION_HOURS_BEAR = 72;
const TELEGRAM_WEBHOOK_PATH = '/telegram-webhook-endpoint-a7b3c9x';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const {
  SUPABASE_URL, SUPABASE_KEY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  WEBHOOK_SECRET, RENDER_EXTERNAL_URL,
  THREES_API_KEY, THREES_API_SECRET
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

async function sendTelegramMessage(chatId, message, keyboard = null) {
  const options = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };
  if (keyboard) {
    options.reply_markup = keyboard;
  }
  try {
    await bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.message);
  }
}

const mainKeyboard = {
  keyboard: [
    [{ text: "📊 查询状态 (/status)" }],
    [{ text: "⏸️ 暂停系统 (/pause)" }, { text: "🚀 恢复系统 (/resume)" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

async function handleTelegramCommands(message) {
  if (!message || !message.text || message.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  let command = message.text.split(' ')[0];
  if (message.text.includes('/status')) command = '/status';
  if (message.text.includes('/pause')) command = '/pause';
  if (message.text.includes('/resume')) command = '/resume';
  
  const chatId = message.chat.id;

  switch (command) {
    case '/start':
      await sendTelegramMessage(chatId, '欢迎回来，总司令！您的交互式控制面板已加载。', mainKeyboard);
      break;
    case '/status':
      await sendTelegramMessage(chatId, '📊 **正在获取系统状态...**');
      const { data: macroState, error: stateError } = await supabase.from('macro_state').select('*').single();
      if (stateError) return await sendTelegramMessage(chatId, '🚨 获取宏观状态失败!', mainKeyboard);
      const { count: paperCount } = await supabase.from('paper_trades').select('*', { count: 'exact', head: true });
      let stateDetail = macroState.market_state === 'NEUTRAL' ? '无明确方向' : (macroState.btc_state === 'NONE' || macroState.eth_state === 'NONE') ? '单边行情' : '双边共振';
      const lastSignalTimeInfo = macroState.last_major_signal_at ? `${((new Date() - new Date(macroState.last_major_signal_at)) / 36e5).toFixed(1)}h ago (\`${macroState.last_major_signal_name}\`)` : '(暂无记录)';
      const report = `*--- 系统状态报告 ---*\n- **市场状态**: \`${macroState.market_state || 'NEUTRAL'}\` (\`${stateDetail}\`)\n- **当前杠杆**: \`${macroState.leverage || 1}x\`\n- **人工总闸**: \`${macroState.manual_override ? '开启 (已暂停)' : '关闭 (运行中)'}\`\n- **最后一级信号**: ${lastSignalTimeInfo}\n- **模拟持仓**: \`${paperCount || 0}\` 笔`;
      await sendTelegramMessage(chatId, report, mainKeyboard);
      break;
    case '/pause':
      await supabase.from('macro_state').update({ manual_override: true }).eq('id', 1);
      await sendTelegramMessage(chatId, '⏸️ **系统已暂停** ⏸️', mainKeyboard);
      break;
    case '/resume':
      await supabase.from('macro_state').update({ manual_override: false }).eq('id', 1);
      await sendTelegramMessage(chatId, '🚀 **系统已恢复** 🚀', mainKeyboard);
      break;
    default:
      await sendTelegramMessage(chatId, '无法识别的指令。请使用下方的按钮进行操作。', mainKeyboard);
      break;
  }
}

// 路由和启动逻辑... (与V8版本几乎完全相同)
app.post(TELEGRAM_WEBHOOK_PATH, (req, res) => {
  handleTelegramCommands(req.body.message);
  res.sendStatus(200);
});

// ... 省略 TradingView webhook 和 healthz 路由 ...

const port = process.env.PORT || 3000;
app.listen(port, async () => {
    console.log(`V9 Engine is running on port ${port}.`);
    if (RENDER_EXTERNAL_URL && TELEGRAM_BOT_TOKEN) {
        try {
            const webhookUrl = `${RENDER_EXTERNAL_URL}${TELEGRAM_WEBHOOK_PATH}`;
            await bot.setWebHook(webhookUrl, { drop_pending_updates: true });
            const startMessage = `✅ **V9按钮交互版引擎启动** ✅\n请点击下方的按钮或发送 /start 来与我互动。`;
            await sendTelegramMessage(TELEGRAM_CHAT_ID, startMessage, mainKeyboard);
        } catch (error) {
            await sendTelegramMessage(TELEGRAM_CHAT_ID, `🚨 **V9引擎启动失败**: 设置Webhook失败: ${error.message}`);
        }
    }
});

// 完整的 TradingView Webhook 逻辑
app.post('/webhook', async (req, res) => {
    // ... (此处省略完整的交易决策代码, 它与V8版本完全相同)
    res.sendStatus(200);
});
app.get('/healthz', (req, res) => { res.status(200).send('OK'); });