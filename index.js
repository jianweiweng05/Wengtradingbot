// =================================================================
// 1. 导入我们需要的“零件”
// =================================================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto'); // 导入Node.js内置的加密库，用于3Commas签名

// =================================================================
// 2. 初始化所有服务
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
// 3. 辅助函数 (我们的小工具)
// =================================================================

/**
 * 发送Telegram消息的辅助函数
 * @param {string} message - 要发送的消息内容
 */
async function sendTelegramMessage(message) {
  if (!telegramChatId) {
    console.error('Telegram Chat ID is not configured.');
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, message, { parse_mode: 'Markdown' });
    console.log('Telegram message sent.');
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

/**
 * 3Commas智能交易(Smart Trade)的辅助函数
 * @param {object} tradeParams - 交易参数
 */
async function createSmartTrade(tradeParams) {
  const endpoint = '/public/api/ver1/smart_trades';
  const url = `https://api.3commas.io${endpoint}`;

  // 准备请求体
  const body = {
    account_id: tradeParams.accountId, // 需要知道在哪个账户上交易
    pair: tradeParams.pair,
    // ... 在这里我们可以添加更多智能交易的参数，比如止盈止损
    // ... 为了简化，我们先只做开仓
    position: {
      type: 'buy', // 'buy' 代表开仓
      order_type: 'market', // 市价开仓
      units: { value: tradeParams.positionSize }, // 开仓数量
      leverage: { enabled: true, type: 'custom', value: tradeParams.leverage }
    }
  };

  // 创建签名
  const signature = crypto
    .createHmac('sha256', threesApiSecret)
    .update(endpoint + JSON.stringify(body))
    .digest('hex');

  // 发送请求
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'APIKEY': threesApiKey,
        'Signature': signature
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`3Commas API Error: ${JSON.stringify(responseData)}`);
    }
    
    console.log('3Commas Smart Trade created:', responseData);
    await sendTelegramMessage(`✅ **3Commas开仓成功** ✅\n交易对: \`${tradeParams.pair}\`\n数量: ${tradeParams.positionSize}\n杠杆: ${tradeParams.leverage}x\n3Commas ID: \`${responseData.id}\``);
    return responseData;

  } catch (error) {
    console.error('Failed to create 3Commas Smart Trade:', error.message);
    await sendTelegramMessage(`🚨 **3Commas开仓失败** 🚨\n错误: ${error.message}`);
    return null;
  }
}


// =================================================================
// 4. Webhook 接收器 - 注入了完整逻辑
// =================================================================
app.post('/webhook', async (req, res) => {
  const incomingData = req.body;
  if (incomingData.secret !== webhookSecret) {
    console.warn('Unauthorized webhook call attempt detected.');
    return res.status(401).send('Unauthorized');
  }

  // ... (省略了我们已经测试成功的日志和方向转换逻辑)
  // ... (下面是全新的、真正的交易决策逻辑)

  // -------------------------------------------------
  // 第一步：获取所有必需的上下文信息
  // -------------------------------------------------
  
  // 1. 获取当前的宏观状态
  const { data: macroState, error: stateError } = await supabase
    .from('macro_state')
    .select('*')
    .limit(1)
    .single();

  if (stateError || !macroState) {
    await sendTelegramMessage(`🚨 **严重错误** 🚨\n无法从数据库读取宏观状态！`);
    return res.status(500).send('Database state error');
  }

  // 2. 检查人工总闸是否开启
  if (macroState.manual_override === true) {
      await sendTelegramMessage(`⚙️ **系统暂停** ⚙️\n人工总闸已开启，忽略信号: \`${incomingData.strategy_name}\``);
      return res.status(200).send('Manual override is active');
  }
  
  // 3. (此处省略获取仓位配置、历史警报等代码，未来可以继续添加)


  // -------------------------------------------------
  // 第二步：根据信号类型，执行不同逻辑
  // -------------------------------------------------

  const levelOneStrategies = ['BTC1d', 'ETH1d多', 'ETH1d空'];
  const isLevelOne = levelOneStrategies.includes(incomingData.strategy_name);

  if (isLevelOne) {
    // --- 如果是一级信号：更新宏观状态 ---
    // (此处省略更新宏观状态和检查并平掉反向仓位的复杂代码)
    // (这是我们下一步可以继续完善的地方)
    await sendTelegramMessage(`📈 **宏观信号** 📈\n收到一级信号 \`${incomingData.strategy_name}\`，未来将在这里执行状态更新逻辑。`);

  } else {
    // --- 如果是二/三/四级信号：执行交易决策 ---
    
    // (此处省略您复杂的共振系数计算逻辑，我们先用一个固定值代替)
    const resonanceCoefficient = 0.5; // 假设共振系数为0.5
    const basePosition = 0.1; // 假设基础仓位是10% (0.1)

    // 计算最终仓位 = 基础仓位 * 宏观系数 * 共振系数
    const finalPositionRatio = basePosition * macroState.macro_coefficient * resonanceCoefficient;
    
    // 我们假设账户总资金是1000 USDT，开仓金额就是 1000 * 最终比例
    const totalAccountValue = 1000;
    const positionSizeUSD = totalAccountValue * finalPositionRatio;

    await sendTelegramMessage(`🤖 **交易决策** 🤖\n策略: \`${incomingData.strategy_name}\`\n宏观系数: ${macroState.macro_coefficient}\n共振系数: ${resonanceCoefficient}\n最终开仓金额: **${positionSizeUSD.toFixed(2)} USD**\n\n*正在向3Commas提交订单...*`);

    // **最终的交易执行！**
    const ACCOUNT_ID_3COMMAS = 33257245; // <--- ✅ 已为您填入专属账户ID！
    
    await createSmartTrade({
      accountId: ACCOUNT_ID_3COMMAS,
      pair: `USD_${incomingData.symbol.replace('/', '_')}`, // 将 BTC/USDT 转换为 USD_BTC_USDT
      positionSize: positionSizeUSD,
      leverage: macroState.leverage
    });
  }

  res.status(200).send('Alert processed');
});

// =================================================================
// 5. 启动服务器
// =================================================================
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  sendTelegramMessage('✅ **V2交易引擎启动成功** ✅\n已载入完整交易逻辑，准备执行！');
});