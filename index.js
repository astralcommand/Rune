// index.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

// ===== POST /summon: Create a full Notion page with content blocks =====
app.post('/summon', async (req, res) => {
  const { title, parentId, blocks } = req.body;

  const notionUrl = 'https://api.notion.com/v1/pages';
  const notionPayload = {
    parent: {
      type: 'page_id',
      page_id: parentId
    },
    properties: {
      title: [
        {
          type: 'text',
          text: { content: title }
        }
      ]
    },
    children: blocks
  };

  try {
    const notionRes = await axios.post(notionUrl, notionPayload, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Notion page created:', notionRes.data.id);
    res.status(200).send('Page successfully summoned to Notion');
  } catch (error) {
    console.error('❌ Failed to create Notion page:', error.response?.data || error.message);
    res.status(500).send('Failed to create Notion page');
  }
});

// ===== POST /trigger: Send one or more tasks to Make =====
app.post('/trigger', async (req, res) => {
  const makeWebhookUrl = 'https://hook.us2.make.com/9y2ve5sbm8jea6k357vz1m416ocgb2f0';

  const tasks = Array.isArray(req.body) ? req.body : [req.body];

  try {
    for (const task of tasks) {
      await axios.post(makeWebhookUrl, task);
    }
    console.log('✨ All tasks dispatched to Make');
    res.status(200).send('All tasks sent to Make');
  } catch (error) {
    console.error('Error in batch trigger:', error.response?.status, error.response?.data || error.message);
    res.status(500).send('Failed to trigger batch to Make');
  }
});

app.listen(port, () => {
  console.log(`Rune server is alive on port ${port}`);
});