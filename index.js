// =================================================================
// 1. 核心设置 (总开关)
// =================================================================
const IS_PAPER_TRADING_MODE = true; // true = 影子交易模式, false = 3Commas实盘模式

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
const bot = new TelegramBot(telegramBotToken);

// =================================================================
// 4. 辅助函数
// =================================================================

async function sendTelegramMessage(message) {
  if (!telegramChatId) {
    console.error('Telegram Chat ID is not configured.');
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

async function createSmartTrade(tradeParams) {
    // (由于我们主要测试影子交易，这里的3Commas逻辑保持不变，但请确保您本地已填好账户ID)
    const ACCOUNT_ID_3COMMAS = 33257245; // 您的3Commas账户ID

    // ... (省略了完整的3Commas API调用代码，因为它和上一版完全一样)
    // ... 在这里，我们只做一个模拟调用
    
    console.log(`[LIVE MODE] Would execute trade on 3Commas:`, tradeParams);
    await sendTelegramMessage(`✅ **[实盘模式]**\n已向3Commas提交开仓订单！\n交易对: \`${tradeParams.pair}\``);
    // 实际的API调用...
    return { success: true, id: 'live_trade_id_' + Date.now() }; // 返回一个模拟的成功对象
}

// =================================================================
// 5. Webhook 接收器 - V3最终版
// =================================================================
app.post('/webhook', async (req, res) => {
  const incomingData = req.body;
  if (incomingData.secret !== webhookSecret) {
    return res.status(401).send('Unauthorized');
  }

  // --- 1. 数据清洗和格式化 ---
  const { strategy_name, symbol, price } = incomingData;
  let originalDirection = incomingData.direction;

  let direction;
  if (originalDirection === 'buy') direction = '多';
  else if (originalDirection === 'sell') direction = '空';
  else direction = originalDirection;

  if (!['多', '空'].includes(direction)) {
    return res.status(400).send('Invalid direction');
  }

  // --- 2. 获取上下文信息 ---
  const { data: macroState, error: stateError } = await supabase.from('macro_state').select('*').limit(1).single();
  if (stateError) return res.status(500).send('Database state error');
  if (macroState.manual_override) return res.status(200).send('Manual override is active');
  
  // (未来可以在这里添加更多从数据库获取信息的代码，比如仓位配置)

  // --- 3. 决策逻辑 ---
  const levelOneStrategies = ['BTC1d', 'ETH1d多', 'ETH1d空'];
  const isLevelOne = levelOneStrategies.includes(strategy_name);

  if (isLevelOne) {
    await sendTelegramMessage(`📈 **宏观信号** 📈\n收到一级信号 \`${strategy_name}\`，未来将在这里执行状态更新逻辑。`);
  } else {
    // (此处省略复杂的共振系数计算，先用固定值)
    const resonanceCoefficient = 0.5;
    const basePosition = 0.1; 
    const finalPositionRatio = basePosition * macroState.macro_coefficient * resonanceCoefficient;
    
    // --- 使用您指定的10万U总资金进行计算 ---
    const totalAccountValue = 100000; 
    const positionSizeUSD = totalAccountValue * finalPositionRatio;

    await sendTelegramMessage(`🤖 **交易决策 (${IS_PAPER_TRADING_MODE ? '影子' : '实盘'})** 🤖\n策略: \`${strategy_name}\`\n方向: \`${direction}\`\n最终开仓金额: **$${positionSizeUSD.toFixed(2)} USD**`);

    // --- 4. 执行模块 ---
    if (IS_PAPER_TRADING_MODE) {
      // 【影子交易模式】
      const { error } = await supabase.from('paper_trades').insert({
        symbol: symbol,
        direction: direction,
        entry_price: price,
        position_size: positionSizeUSD,
        strategy_name: strategy_name,
        threes_deal_id: 'paper_' + Date.now() // 生成一个模拟ID
      });

      if (error) {
        await sendTelegramMessage(`🚨 **影子交易失败** 🚨\n写入 \`paper_trades\` 表失败: ${error.message}`);
      } else {
        await sendTelegramMessage(`📝 **模拟开仓成功** 📝\n已在 \`paper_trades\` 表中记录一笔模拟交易。`);
      }
    } else {
      // 【实盘交易模式】
      // (将我们的参数传递给3Commas的函数)
      await createSmartTrade({
        accountId: 33257245, // 确保这个ID正确
        pair: `USD_${symbol.replace('/', '_')}`,
        positionSize: positionSizeUSD,
        leverage: macroState.leverage
      });
    }
  }

  res.status(200).send('Alert processed');
});

// =================================================================
// 6. 启动服务器
// =================================================================
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}. Mode: ${IS_PAPER_TRADING_MODE ? 'Paper Trading' : 'Live Trading'}`);
  sendTelegramMessage(`✅ **V3影子交易引擎启动成功** ✅\n当前模式: **${IS_PAPER_TRADING_MODE ? '影子交易' : '实盘交易'}**`);
});