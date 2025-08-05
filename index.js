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

// ===== POST /trigger: Create tasks directly in Notion =====
app.post('/trigger', async (req, res) => {
  const tasks = Array.isArray(req.body) ? req.body : [req.body];
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  });

  try {
    for (const task of tasks) {
      await notion.post('pages', {
        parent: { database_id: process.env.MASTER_TASK_DB_ID },
        properties: {
          Title: {
            title: [{ text: { content: task.title } }]
          },
          Due: {
            date: { start: task.dueDate }
          },
          Council: {
            select: { name: task.councilMember }
          },
          Stellar_Weight: {
            select: { name: task.stellarWeight }
          },
          State: {
            select: { name: task.stateOfPlay }
          },
          Notes: {
            rich_text: [{ text: { content: task.notes } }]
          },
          Glyph: {
            select: { name: task.originalGlyph }
          }
        }
      });
    }
    res.status(200).send('All tasks created in Notion');
  } catch (error) {
    console.error('Notion task creation failed:', error.response?.data || error.message);
    res.status(500).send('Failed to create tasks in Notion');
  }
});