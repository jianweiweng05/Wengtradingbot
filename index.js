// =================================================================
// 1. 导入我们需要的“零件”
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

// =================================================================
// 2. 初始化所有服务
// =================================================================
const app = express();
app.use(express.json()); 

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(telegramBotToken);

// =================================================================
// 3. 辅助函数
// =================================================================
async function sendTelegramMessage(message) {
  if (!telegramChatId) {
    console.error('Telegram Chat ID is not configured in Secrets.');
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

// =================================================================
// 4. Webhook 接收器
// =================================================================
app.post('/webhook', async (req, res) => {
  const incomingData = req.body;
  
  if (incomingData.secret !== webhookSecret) {
    console.warn('Unauthorized webhook call attempt detected.');
    return res.status(401).send('Unauthorized');
  }

  console.log('Received alert:', JSON.stringify(incomingData, null, 2));
  await sendTelegramMessage(`🔔 **收到一个测试信号** 🔔\n\`\`\`json\n${JSON.stringify(incomingData, null, 2)}\n\`\`\``);

  res.status(200).send('Alert received');
});

// =================================================================
// 5. 启动服务器
// =================================================================
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  sendTelegramMessage('✅ **Render部署版本-系统启动成功** ✅');
});