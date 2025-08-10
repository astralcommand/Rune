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
          "When": { select: { name: task.when } },
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
// --- /catalog: workspace-wide DB Directory upsert ---
app.post('/catalog', async (req, res) => {
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });

  const DIR_ID = process.env.DB_DIRECTORY_DB_ID;
  if (!DIR_ID) return res.status(400).send('Missing DB_DIRECTORY_DB_ID');

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const upsertRow = async ({ name, dbId, parentType, parentId, lastEdited }) => {
    // Find existing by Database ID
    const q = await notion.post(`databases/${DIR_ID}/query`, {
      filter: { property: 'Database ID', rich_text: { equals: dbId } }
    });

    const props = {
      'Name': { title: [{ text: { content: name || 'Untitled' } }] },
      'Database ID': { rich_text: [{ text: { content: dbId } }] },
      'Parent Type': { select: { name: parentType } },
      'Parent ID': { rich_text: [{ text: { content: parentId || '' } }] },
      'Last Edited': { date: { start: lastEdited } },
      'Scope': { select: { name: 'Workspace' } },
    };

    if (q.data.results?.length) {
      const pageId = q.data.results[0].id;
      await notion.patch(`pages/${pageId}`, { properties: props });
    } else {
      await notion.post('pages', { parent: { database_id: DIR_ID }, properties: props });
    }
  };

  try {
    let next_cursor = undefined;
    let total = 0;

    do {
      const resp = await notion.post('search', {
        filter: { value: 'database', property: 'object' },
        start_cursor: next_cursor,
        page_size: 100
      });

      for (const db of resp.data.results || []) {
        const name = db.title?.[0]?.plain_text || 'Untitled';
        const dbId = db.id;
        const parentType = db.parent?.type === 'workspace' ? 'workspace' : 'page_id';
        const parentId = db.parent?.page_id || '';
        const lastEdited = db.last_edited_time;

        await upsertRow({ name, dbId, parentType, parentId, lastEdited });
        total++;
        await sleep(200); // be kind to Notion rate limits
      }

      next_cursor = resp.data.has_more ? resp.data.next_cursor : undefined;
    } while (next_cursor);

    res.status(200).json({ ok: true, indexed: total, scope: 'Workspace' });
  } catch (err) {
    console.error('catalog error:', err.response?.data || err.message);
    res.status(500).send('Failed to build DB Directory');
  }
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});
