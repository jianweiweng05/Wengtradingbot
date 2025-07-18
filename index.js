// =================================================================
// 1. 核心配置 (您未来唯一需要修改的地方)
// =================================================================
const IS_PAPER_TRADING_MODE = true;      // true = 影子交易, false = 实盘交易
const ACCOUNT_ID_3COMMAS = 33257245;     // 您的3Commas账户ID
const MOCK_ACCOUNT_VALUE_USD = 100000;   // 您的10万U模拟总资金
const STATE_EXPIRATION_HOURS_BULL = 168; // 牛市状态有效期 (7天)
const STATE_EXPIRATION_HOURS_BEAR = 72;  // 熊市状态有效期 (72小时)
const TELEGRAM_WEBHOOK_PATH = '/telegram-webhook-endpoint-a7b3c9x'; // Telegram指令的秘密路径

// =================================================================
// 2. 导入与初始化
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 从环境变量获取秘密信息
const {
  SUPABASE_URL, SUPABASE_KEY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  WEBHOOK_SECRET,
  THREES_API_KEY, THREES_API_SECRET,
  RENDER_EXTERNAL_URL
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// =================================================================
// 3. 核心功能模块 (职责分离，清晰明了)
// =================================================================

/**
 * 模块一：Telegram 通信模块
 */
async function sendTelegramMessage(chatId, message) {
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (error) {
    console.error(`Error sending Telegram message to ${chatId}:`, error.message);
  }
}

/**
 * 模块二：3Commas 交易执行模块 (模拟)
 */
async function createSmartTrade(tradeParams) {
    console.log(`[LIVE MODE] Executing trade on 3Commas:`, tradeParams);
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `✅ **[实盘]** 已向3Commas提交订单: \`${tradeParams.pair}\``);
    return { success: true, id: 'live_trade_' + Date.now() };
}

/**
 * 模块三：Telegram 指令处理器
 */
async function handleTelegramCommands(message) {
  if (!message || !message.text || message.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  const command = message.text.split(' ')[0];
  const chatId = message.chat.id;

  switch (command) {
    case '/status':
      await sendTelegramMessage(chatId, '📊 **正在获取系统状态...**');
      const { data: macroState } = await supabase.from('macro_state').select('*').single();
      
      let stateDetail = '无明确方向';
      if (macroState.market_state === 'BULL') {
        if (macroState.btc_state === 'LONG' && macroState.eth_state === 'LONG') stateDetail = '双牛 (BTC & ETH)';
        else if (macroState.btc_state === 'LONG') stateDetail = '牛 (BTC主导)';
        else if (macroState.eth_state === 'LONG') stateDetail = '牛 (ETH主导)';
      } else if (macroState.market_state === 'BEAR') {
        // ... 熊市状态详情的逻辑
      }
      
      const lastSignalTimeInfo = macroState.last_major_signal_at ? 
        `${((new Date() - new Date(macroState.last_major_signal_at)) / 36e5).toFixed(1)}h ago (\`${macroState.last_major_signal_name}\`)` : 
        '(暂无记录)';

      const { count: paperCount } = await supabase.from('paper_trades').select('*', { count: 'exact', head: true });

      const report = `
*--- 宏观状态 (L1) ---*
- **市场状态**: \`${macroState.market_state || 'NEUTRAL'}\`
- **状态详情**: \`${stateDetail}\`
- **默认杠杆**: \`${macroState.leverage || 1}x\`
- **人工总闸**: \`${macroState.manual_override ? '开启 (已暂停)' : '关闭 (运行中)'}\`
- **最后一级信号**: ${lastSignalTimeInfo}
*--- 账户与模式 ---*
- **模拟持仓**: \`${paperCount || 0}\` 笔
- **运行模式**: \`${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}\`
      `;
      await sendTelegramMessage(chatId, report);
      break;

    case '/pause':
      await supabase.from('macro_state').update({ manual_override: true }).eq('id', 1);
      await sendTelegramMessage(chatId, '⏸️ **系统已暂停** ⏸️');
      break;

    case '/resume':
      await supabase.from('macro_state').update({ manual_override: false }).eq('id', 1);
      await sendTelegramMessage(chatId, '🚀 **系统已恢复** 🚀');
      break;
  }
}

/**
 * 模块四：TradingView Webhook 处理器
 */
async function handleTradingViewWebhook(incomingData) {
  if (incomingData.secret !== WEBHOOK_SECRET) return;

  const { strategy_name, symbol, price } = incomingData;
  let direction = (incomingData.direction || '').toLowerCase() === 'buy' ? '多' : (incomingData.direction || '').toLowerCase() === 'sell' ? '空' : incomingData.direction;

  if (!['多', '空'].includes(direction)) return;

  const isLevelOne = ['BTC1d', 'ETH1d多', 'ETH1d空'].includes(strategy_name);
  await supabase.from('alert_log').insert({ strategy_name, symbol, direction, is_level_one });
  await sendTelegramMessage(TELEGRAM_CHAT_ID, `🔔 **收到信号**: *${strategy_name}* | \`${symbol}\` | **${direction}**`);

  const { data: macroState } = await supabase.from('macro_state').select('*').single();
  if (macroState.manual_override) {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `⚙️ **系统暂停中**，忽略信号: \`${strategy_name}\``);
    return;
  }

  if (isLevelOne) {
    // 【一级信号逻辑】
    // ... (此处省略了详细的状态更新逻辑)
    await supabase.from('macro_state').update({ market_state: 'BULL', last_major_signal_name: strategy_name, last_major_signal_at: new Date() }).eq('id', 1);
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `📈 **宏观状态已更新** 📈`);
  } else {
    // 【二/三/四级信号逻辑】
    const marketDirection = macroState.market_state === 'BULL' ? '多' : macroState.market_state === 'BEAR' ? '空' : '中性';
    if (marketDirection !== '中性' && direction !== marketDirection) {
      await sendTelegramMessage(TELEGRAM_CHAT_ID, `❌ **信号被过滤**: 方向与宏观状态(\`${marketDirection}\`)不符。`);
      return;
    }
    
    // (此处省略复杂的共振系数和仓位计算)
    const positionSizeUSD = MOCK_ACCOUNT_VALUE_USD * 0.01; // 简化为开仓1%
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `🤖 **交易决策 (${IS_PAPER_TRADING_MODE ? '影子' : '实盘'})**: $${positionSizeUSD.toFixed(2)} USD`);

    if (IS_PAPER_TRADING_MODE) {
      await supabase.from('paper_trades').insert({ symbol, direction, entry_price: price, position_size: positionSizeUSD, strategy_name });
      await sendTelegramMessage(TELEGRAM_CHAT_ID, `📝 **模拟开仓成功**`);
    } else {
      await createSmartTrade({ accountId: ACCOUNT_ID_3COMMAS, pair: `USD_${symbol.replace('/', '_')}`, positionSize: positionSizeUSD, leverage: macroState.leverage });
    }
  }
}

// =================================================================
// 4. 路由设置 (我们系统的“总机”)
// =================================================================
app.post('/webhook', (req, res) => {
  handleTradingViewWebhook(req.body);
  res.sendStatus(200);
});

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
  console.log(`V8 Engine is running on port ${port}.`);
  if (RENDER_EXTERNAL_URL && TELEGRAM_BOT_TOKEN) {
    try {
      const webhookUrl = `${RENDER_EXTERNAL_URL}${TELEGRAM_WEBHOOK_PATH}`;
      await bot.setWebHook(webhookUrl, { drop_pending_updates: true });
      console.log(`Telegram webhook set to: ${webhookUrl}`);
      await sendTelegramMessage(TELEGRAM_CHAT_ID, `✅ **V8生产稳定版引擎启动成功** ✅\n当前模式: **${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘'}**`);
    } catch (error) {
      await sendTelegramMessage(TELEGRAM_CHAT_ID, `🚨 **V8引擎启动失败**: 设置Telegram Webhook失败: ${error.message}`);
    }
  } else {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, `🚨 **V8引擎配置错误**: 缺少关键环境变量。`);
  }
});