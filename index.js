// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

// health check
app.get('/', (req, res) => {
  res.send('🥳 Hello from Rune!');
});

// ===== POST /summon: Create a full Notion page with content blocks =====
app.post('/summon', async (req, res) => {
  const { title, parentId, blocks } = req.body;

  try {
    const notionRes = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { page_id: parentId, type: 'page_id' },
        properties: {
          title: [
            {
              text: { content: title }
            }
          ]
        },
        children: blocks
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Notion page created:', notionRes.data.id);
    res.status(200).json({ pageId: notionRes.data.id });
  } catch (error) {
    console.error('❌ Failed to create Notion page:', error.response?.data || error.message);
    res.status(500).send('Failed to create Notion page');
  }
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});