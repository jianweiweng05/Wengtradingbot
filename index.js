{\rtf1\ansi\ansicpg936\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww30040\viewh16620\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const \{ createClient \} = require('@supabase/supabase-js');\
const axios = require('axios');\
const express = require('express');\
\
// \uc0\u21021 \u22987 \u21270 Supabase\
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);\
\
// 3Commas\uc0\u20132 \u26131 \u25191 \u34892 \u20989 \u25968 \
async function executeTrade(order) \{\
  try \{\
    const response = await axios.post(\
      `https://api.3commas.io/bots/$\{process.env.BOT_ID\}/execute`,\
      \{\
        pair: order.pair,\
        action: order.action,\
        units: \{ type: 'percentage', value: order.amount \},\
        leverage: order.leverage\
      \},\
      \{ headers: \{ 'APIKEY': process.env.THREES_API_KEY \} \}\
    );\
    console.log('\uc0\u20132 \u26131 \u25104 \u21151 :', response.data);\
  \} catch (error) \{\
    console.error('\uc0\u20132 \u26131 \u22833 \u36133 :', error.response?.data || error.message);\
  \}\
\}\
\
// \uc0\u21019 \u24314 Web\u26381 \u21153 \
const app = express();\
app.use(express.json());\
\
app.post('/webhook', async (req, res) => \{\
  const signal = req.body;\
  console.log('\uc0\u25910 \u21040 \u20449 \u21495 :', signal);\
\
  // \uc0\u36825 \u37324 \u28155 \u21152 \u24744 \u30340 \u20132 \u26131 \u36923 \u36753 \
  // \uc0\u31034 \u20363 \u65306 \u30452 \u25509 \u36716 \u21457 \u20449 \u21495 \
  await executeTrade(\{\
    pair: `$\{signal.symbol\}_USDT`,\
    action: signal.action,\
    amount: 0.1, // \uc0\u27979 \u35797 \u29992 \u22266 \u23450 10%\u20179 \u20301 \
    leverage: 1\
  \});\
\
  res.sendStatus(200);\
\});\
\
const PORT = process.env.PORT || 3000;\
app.listen(PORT, () => console.log(`\uc0\u26381 \u21153 \u36816 \u34892 \u20013 : http://localhost:$\{PORT\}`));}