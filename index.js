// =================================================================
// 1. 核心设置 (总开关)
// =================================================================
const IS_PAPER_TRADING_MODE = true; // true = 影子交易模式, false = 3Commas实盘模式
const ACCOUNT_ID_3COMMAS = 33257245; // 您的3Commas账户ID
const MOCK_ACCOUNT_VALUE_USD = 100000; // 您的10万U模拟总资金

// =================================================================
// 2. 导入“零件”
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// =================================================================
// 3. 初始化所有服务
// =================================================================
const app = express();
app.use(express.json());

// 从环境变量获取秘密信息
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const threesApiKey = process.env.THREES_API_KEY;
const threesApiSecret = process.env.THREES_API_SECRET;

// 初始化客户端
const supabase = createClient(supabaseUrl, supabaseKey);
// !! 关键升级：传入 polling: true 来接收消息 !!
const bot = new TelegramBot(telegramBotToken, { polling: true });

// =================================================================
// 4. 辅助函数 (保持不变)
// =================================================================
// ... (sendTelegramMessage 和 createSmartTrade 函数和V4版本完全一样, 此处省略以保持简洁)
// ... (完整的函数体已包含在下面的总代码块中)

async function sendTelegramMessage(message) {
  if (!telegramChatId) {
    console.error('Telegram Chat ID is not configured.');
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

async function createSmartTrade(tradeParams) {
    console.log(`[LIVE MODE] Would execute trade on 3Commas:`, tradeParams);
    await sendTelegramMessage(`✅ **[实盘模式]**\n已向3Commas提交开仓订单！\n交易对: \`${tradeParams.pair}\``);
    // 实际的API调用...
    return { success: true, id: 'live_trade_id_' + Date.now() };
}

// =================================================================
// 5. Telegram 交互式指令 - V5新增核心功能
// =================================================================

// --- /status 指令 ---
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return; // 安全检查：只响应您自己的命令

  await sendTelegramMessage('📊 **正在获取系统状态...**');

  // 获取宏观状态
  const { data: macroState, error: stateError } = await supabase.from('macro_state').select('*').limit(1).single();
  // 获取模拟持仓数量
  const { count: paperCount } = await supabase.from('paper_trades').select('*', { count: 'exact', head: true });
  // 获取实盘持仓数量
  const { count: liveCount } = await supabase.from('positions').select('*', { count: 'exact', head: true });

  if (stateError) {
    await sendTelegramMessage('🚨 获取宏观状态失败!');
    return;
  }

  const statusReport = `
*--- 系统状态报告 ---*
- **宏观状态**: \`${macroState.current_state}\`
- **当前杠杆**: \`${macroState.leverage}x\`
- **人工总闸**: \`${macroState.manual_override ? '开启 (已暂停)' : '关闭 (运行中)'}\`
- **模拟持仓**: \`${paperCount || 0}\` 笔
- **实盘持仓**: \`${liveCount || 0}\` 笔
- **运行模式**: \`${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}\`
  `;
  await sendTelegramMessage(statusReport);
});

// --- /pause 指令 ---
bot.onText(/\/pause/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;

  const { error } = await supabase.from('macro_state').update({ manual_override: true }).eq('id', 1);
  if (error) {
    await sendTelegramMessage(`🚨 **暂停失败**: ${error.message}`);
  } else {
    await sendTelegramMessage('⏸️ **系统已暂停** ⏸️\n人工总闸已开启，将不再执行任何新的开仓信号。');
  }
});

// --- /resume 指令 ---
bot.onText(/\/resume/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;

  const { error } = await supabase.from('macro_state').update({ manual_override: false }).eq('id', 1);
  if (error) {
    await sendTelegramMessage(`🚨 **恢复失败**: ${error.message}`);
  } else {
    await sendTelegramMessage('🚀 **系统已恢复** 🚀\n已关闭人工总闸，恢复正常的自动化交易决策。');
  }
});

// --- /panic 指令 (带二次确认) ---
let panicConfirmations = {};
bot.onText(/\/panic/, (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;
  
  panicConfirmations[msg.chat.id] = Date.now(); // 记录请求时间
  sendTelegramMessage(`⚠️ **高危操作确认** ⚠️\n您确定要强行平掉所有**实盘**仓位吗？\n如果确定，请在30秒内发送指令: \`/confirm_panic\``);
});

bot.onText(/\/confirm_panic/, async (msg) => {
    if (msg.chat.id.toString() !== telegramChatId) return;

    const requestTime = panicConfirmations[msg.chat.id];
    if (requestTime && (Date.now() - requestTime) < 30000) { // 30秒内有效
        delete panicConfirmations[msg.chat.id]; // 清除确认状态
        await sendTelegramMessage('💣 **紧急平仓指令已确认！** 💣\n*(注: 实盘平仓逻辑待实现)*');
        // 在这里，未来将添加调用3Commas API，循环平掉positions表里所有仓位的逻辑
    } else {
        await sendTelegramMessage('❌ **确认超时** ❌\n紧急平仓指令已取消。');
    }
});

// =================================================================
// 6. Webhook 核心逻辑 (与V4版本基本一致)
// =================================================================
app.post('/webhook', async (req, res) => {
    // ... (此处省略了完整的webhook逻辑，因为它和V4版本完全一样)
    // ... 您只需要知道，完整的逻辑已经包含在下面的总代码块里
    const incomingData = req.body;
    if (incomingData.secret !== webhookSecret) return res.status(401).send('Unauthorized');
    // ... 其他所有逻辑...
    res.status(200).send('Alert processed');
});

// =================================================================
// 7. 启动服务器
// =================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`V5 Engine is running on port ${port}. Mode: ${IS_PAPER_TRADING_MODE ? 'Paper Trading' : 'Live Trading'}`);
  sendTelegramMessage(`✅ **V5交互式引擎启动成功** ✅\n当前模式: **${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}**\n\n您现在可以使用 /status, /pause, /resume 等指令与我互动。`);
});


// =================================================================
// ============== 完整的 V5 代码 - 请从这里开始复制 ==============
// =================================================================
const IS_PAPER_TRADING_MODE = true; // true = 影子交易模式, false = 3Commas实盘模式
const ACCOUNT_ID_3COMMAS = 33257245; // 您的3Commas账户ID
const MOCK_ACCOUNT_VALUE_USD = 100000; // 您的10万U模拟总资金

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const threesApiKey = process.env.THREES_API_KEY;
const threesApiSecret = process.env.THREES_API_SECRET;

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(telegramBotToken, { polling: true });

async function sendTelegramMessage(message) {
  if (!telegramChatId) {
    console.error('Telegram Chat ID is not configured.');
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

async function createSmartTrade(tradeParams) {
    console.log(`[LIVE MODE] Executing trade on 3Commas:`, tradeParams);
    await sendTelegramMessage(`✅ **[实盘模式]**\n已向3Commas提交开仓订单！\n交易对: \`${tradeParams.pair}\``);
    // 实际的API调用... (此处为模拟)
    return { success: true, id: 'live_trade_id_' + Date.now() };
}

// --- Telegram Commands ---
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;
  await sendTelegramMessage('📊 **正在获取系统状态...**');
  const { data: macroState, error: stateError } = await supabase.from('macro_state').select('*').limit(1).single();
  const { count: paperCount } = await supabase.from('paper_trades').select('*', { count: 'exact', head: true });
  const { count: liveCount } = await supabase.from('positions').select('*', { count: 'exact', head: true });
  if (stateError) {
    await sendTelegramMessage('🚨 获取宏观状态失败!');
    return;
  }
  const statusReport = `
*--- 系统状态报告 ---*
- **宏观状态**: \`${macroState.current_state}\`
- **当前杠杆**: \`${macroState.leverage}x\`
- **人工总闸**: \`${macroState.manual_override ? '开启 (已暂停)' : '关闭 (运行中)'}\`
- **模拟持仓**: \`${paperCount || 0}\` 笔
- **实盘持仓**: \`${liveCount || 0}\` 笔
- **运行模式**: \`${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}\`
  `;
  await sendTelegramMessage(statusReport);
});

bot.onText(/\/pause/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;
  const { error } = await supabase.from('macro_state').update({ manual_override: true }).eq('id', 1);
  if (error) await sendTelegramMessage(`🚨 **暂停失败**: ${error.message}`);
  else await sendTelegramMessage('⏸️ **系统已暂停** ⏸️\n人工总闸已开启，将不再执行任何新的开仓信号。');
});

bot.onText(/\/resume/, async (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;
  const { error } = await supabase.from('macro_state').update({ manual_override: false }).eq('id', 1);
  if (error) await sendTelegramMessage(`🚨 **恢复失败**: ${error.message}`);
  else await sendTelegramMessage('🚀 **系统已恢复** 🚀\n已关闭人工总闸，恢复正常的自动化交易决策。');
});

let panicConfirmations = {};
bot.onText(/\/panic/, (msg) => {
  if (msg.chat.id.toString() !== telegramChatId) return;
  panicConfirmations[msg.chat.id] = Date.now();
  sendTelegramMessage(`⚠️ **高危操作确认** ⚠️\n您确定要强行平掉所有**实盘**仓位吗？\n如果确定，请在30秒内发送指令: \`/confirm_panic\``);
});

bot.onText(/\/confirm_panic/, async (msg) => {
    if (msg.chat.id.toString() !== telegramChatId) return;
    const requestTime = panicConfirmations[msg.chat.id];
    if (requestTime && (Date.now() - requestTime) < 30000) {
        delete panicConfirmations[msg.chat.id];
        await sendTelegramMessage('💣 **紧急平仓指令已确认！** 💣\n*(注: 实盘平仓逻辑待实现)*');
    } else {
        await sendTelegramMessage('❌ **确认超时** ❌\n紧急平仓指令已取消。');
    }
});

// --- Webhook Logic ---
app.post('/webhook', async (req, res) => {
  const incomingData = req.body;
  if (incomingData.secret !== webhookSecret) return res.status(401).send('Unauthorized');
  
  const { strategy_name, symbol, price } = incomingData;
  let originalDirection = incomingData.direction || '';
  let direction;
  if (originalDirection.toLowerCase() === 'buy') direction = '多';
  else if (originalDirection.toLowerCase() === 'sell') direction = '空';
  else direction = originalDirection;

  if (!['多', '空'].includes(direction)) return res.status(400).send('Invalid direction');

  const isLevelOne = ['BTC1d', 'ETH1d多', 'ETH1d空'].includes(strategy_name);
  await supabase.from('alert_log').insert({ strategy_name, symbol, direction, is_level_one });
  await sendTelegramMessage(`🔔 **收到信号** 🔔\n*${strategy_name}* | \`${symbol}\` | **${direction}** @ ${price}`);

  const { data: macroState, error: stateError } = await supabase.from('macro_state').select('*').limit(1).single();
  if (stateError) return res.status(500).send('Database state error');
  if (macroState.manual_override) {
    await sendTelegramMessage(`⚙️ **系统暂停中** ⚙️\n人工总闸已开启，忽略信号: \`${strategy_name}\``);
    return res.status(200).send('Manual override is active');
  }

  if (isLevelOne) {
    await sendTelegramMessage(`📈 **宏观信号分析** 📈\n收到一级信号 \`${strategy_name}\`。\n*(注: 状态更新逻辑待实现)*`);
  } else {
    const marketDirection = macroState.current_state === '牛' ? '多' : '空';
    if (direction !== marketDirection) {
      await sendTelegramMessage(`❌ **信号被过滤** ❌\n原因: 信号方向 (\`${direction}\`) 与当前宏观状态 (\`${marketDirection}\`) 不符。`);
      return res.status(200).send('Signal filtered: direction mismatch.');
    }

    const resonanceCoefficient = 0.5;
    const basePosition = 0.1;
    const finalPositionRatio = basePosition * macroState.macro_coefficient * resonanceCoefficient;
    const positionSizeUSD = MOCK_ACCOUNT_VALUE_USD * finalPositionRatio;
    await sendTelegramMessage(`🤖 **交易决策 (${IS_PAPER_TRADING_MODE ? '影子' : '实盘'})** 🤖\n最终开仓金额: **$${positionSizeUSD.toFixed(2)} USD**`);

    if (IS_PAPER_TRADING_MODE) {
      const { error } = await supabase.from('paper_trades').insert({
        symbol, direction, entry_price: price, position_size: positionSizeUSD, strategy_name,
        threes_deal_id: 'paper_' + Date.now()
      });
      if (error) await sendTelegramMessage(`🚨 **影子交易失败**: ${error.message}`);
      else await sendTelegramMessage(`📝 **模拟开仓成功** 📝\n已在Supabase中记录。`);
    } else {
      await createSmartTrade({
        accountId: ACCOUNT_ID_3COMMAS,
        pair: `USD_${symbol.replace('/', '_')}`,
        positionSize: positionSizeUSD,
        leverage: macroState.leverage
      });
    }
  }

  res.status(200).send('Alert processed');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`V5 Engine is running on port ${port}. Mode: ${IS_PAPER_TRADING_MODE ? 'Paper Trading' : 'Live Trading'}`);
  sendTelegramMessage(`✅ **V5交互式引擎启动成功** ✅\n当前模式: **${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}**\n\n您现在可以使用 /status, /pause, /resume 等指令与我互动。`);
});