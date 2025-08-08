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
});// ===== POST /trigger: Create tasks directly in Notion (batch or single) =====
// inside index.js, replace your /trigger handler with this:
app.post('/trigger', async (req, res) => {
  const tasks = Array.isArray(req.body) ? req.body : [req.body];
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });

  try {
    for (const task of tasks) {
      await notion.post('pages', {
        parent: { database_id: process.env.MASTER_TASK_DB_ID },
        properties: {
          "Title": {
            title: [{ text: { content: task.title } }]
          },
          "Due Date": {
            date: { start: task.dueDate }
          },
          "Council Members": {
            select: { name: task.councilMember }
          },
          "Stellar Weight": {
            select: { name: task.stellarWeight }
          },
          "Time Block": { select: { name: task.timeBlock } 
          },
"Energy Required": { select: { name: task.energyRequired } },
          "State of Play": {
            status: { name: task.stateOfPlay }
          },
          "Notes": {
            rich_text: [{ text: { content: task.notes } }]
          },
          "Original Glyph": {
            select: { name: task.originalGlyph }
          }
        }
      });
    }
    console.log(`✅ Created ${tasks.length} task(s) in Notion`);
    res.status(200).send(`✅ Created ${tasks.length} task(s) in Notion`);
  } catch (err) {
    console.error('❌ /trigger error:', err.response?.data || err.message);
    res.status(500).send('❌ Failed to create tasks in Notion');
  }
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});
