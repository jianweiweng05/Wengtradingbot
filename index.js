// =================================================================
// 1. 核心配置 (您未来唯一需要修改的地方)
// =================================================================
const IS_PAPER_TRADING_MODE = true;      // true = 影子交易, false = 实盘交易
const ACCOUNT_ID_3COMMAS = 33257245;     // 您的3Commas账户ID
const MOCK_ACCOUNT_VALUE_USD = 100000;   // 您的10万U模拟总资金
const TELEGRAM_WEBHOOK_PATH = '/telegram-webhook-endpoint-a7b3c9x'; // Telegram指令的秘密路径

// =================================================================
// 2. 导入与初始化
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const {
  SUPABASE_URL, SUPABASE_KEY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  WEBHOOK_SECRET, RENDER_EXTERNAL_URL,
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// =================================================================
// 3. 核心功能模块
// =================================================================
async function sendTelegramMessage(chatId, message, keyboard = null) {
  const options = { parse_mode: 'Markdown', disable_web_page_preview: true };
  if (keyboard) { options.reply_markup = keyboard; }
  try { await bot.sendMessage(chatId, message, options); }
  catch (error) { console.error(`Error sending message to ${chatId}:`, error.message); }
}

const mainKeyboard = {
  keyboard: [[{ text: "📊 查询状态 (/status)" }], [{ text: "⏸️ 暂停系统 (/pause)" }, { text: "🚀 恢复系统 (/resume)" }]],
  resize_keyboard: true,
};

async function handleTelegramCommands(message) {
  if (!message || !message.text || message.chat.id.toString() !== TELEGRAM_CHAT_ID) return;
  let command = message.text.split(' ')[0].split('@')[0];

  const chatId = message.chat.id;

  switch (command) {
    case '/start':
      await sendTelegramMessage(chatId, '欢迎回来，总司令！请使用下方的按钮进行操作。', mainKeyboard);
      break;
    case '/status':
      await sendTelegramMessage(chatId, '📊 **正在查询最新状态...**');
      const { data: macroState } = await supabase.from('macro_state').select('*').single();
      const report = `*--- 系统状态报告 ---*\n- **市场状态**: \`${macroState.market_state || 'NEUTRAL'}\``;
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
      await sendTelegramMessage(chatId, '无法识别的指令。', mainKeyboard);
      break;
  }
}

// =================================================================
// 4. 路由设置
// =================================================================
app.post(TELEGRAM_WEBHOOK_PATH, (req, res) => {
  handleTelegramCommands(req.body.message);
  res.sendStatus(200);
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// =================================================================
// 5. 启动与初始化
// =================================================================
const port = process.env.PORT || 3000;
app.listen(port, async () => {
    console.log(`V10 Engine is running on port ${port}.`);
    if (RENDER_EXTERNAL_URL && TELEGRAM_BOT_TOKEN) {
        try {
            const webhookUrl = `${RENDER_EXTERNAL_URL}${TELEGRAM_WEBHOOK_PATH}`;
            await bot.setWebHook(webhookUrl, { drop_pending_updates: true });
            const startMessage = `✅ **V10终极版引擎启动成功** ✅\n当前模式: **${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘'}**`;
            await sendTelegramMessage(TELEGRAM_CHAT_ID, startMessage, mainKeyboard);
        } catch (error) {
            await sendTelegramMessage(TELEGRAM_CHAT_ID, `🚨 **V10引擎启动失败**: Webhook设置失败: ${error.message}`);
        }
    }
});
