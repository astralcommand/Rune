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
// --- helper: build the DB Directory (workspace scope) ---
async function buildDbDirectory() {
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });

  const DIR_ID = process.env.DB_DIRECTORY_DB_ID;
  if (!DIR_ID) throw new Error('Missing DB_DIRECTORY_DB_ID');

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const upsertRow = async ({ name, dbId, parentType, parentId, lastEdited }) => {
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
      await sleep(200); // Notion rate limit kindness
    }

    next_cursor = resp.data.has_more ? resp.data.next_cursor : undefined;
  } while (next_cursor);

  return { indexed: total };
}

// Keep your existing POST /catalog if you want.
// One-click GET alias:
app.get('/catalog/refresh', async (req, res) => {
  try {
    const { indexed } = await buildDbDirectory();
    res.status(200).send(`✅ DB Directory refreshed. Indexed ${indexed} database(s).`);
  } catch (err) {
    console.error('catalog refresh error:', err.response?.data || err.message);
    res.status(500).send('❌ Failed to refresh DB Directory');
  }
});
// --- /state: log end-of-session blurbs into Council Ledger ---
app.post('/state', async (req, res) => {
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });

  const LEDGER_DB_ID = process.env.COUNCIL_LEDGER_DB_ID;
  if (!LEDGER_DB_ID) return res.status(400).send('Missing COUNCIL_LEDGER_DB_ID');

  const entries = Array.isArray(req.body) ? req.body : [req.body];
  const isoDate = (d) => (d || new Date().toISOString()).split('T')[0];

  try {
    for (const e of entries) {
      await notion.post('pages', {
        parent: { database_id: LEDGER_DB_ID },
        properties: {
          "Title": { title: [{ text: { content: e.title || `${e.member || 'Member'} — ${isoDate()}` } }] },
          "Member": { select: { name: e.member } },
          "State of Play": { status: { name: e.state || e.stateOfPlay } },
          "Focus": { rich_text: [{ text: { content: e.focus || '' } }] },
          "Blocker": { rich_text: [{ text: { content: e.blocker || '' } }] },
          "Next Action": { rich_text: [{ text: { content: e.next || e.nextAction || '' } }] },
          "When": { select: { name: e.when } },
          "Energy on Nova": { select: { name: e.energy || e.energyOnNova } },
          "Resistance": { select: { name: e.resistance } },
          "Vibe": { number: typeof e.vibe === 'number' ? e.vibe : undefined },
          "Win": { rich_text: [{ text: { content: e.win || '' } }] },
          "Reference Link": { url: e.link || null },
          "Logged At": { date: { start: e.loggedAt ? isoDate(e.loggedAt) : isoDate() } }
        }
      });
      await new Promise(r => setTimeout(r, 150)); // gentle on rate limits
    }
    res.status(200).send(`Logged ${entries.length} ledger entr${entries.length>1?'ies':'y'}.`);
  } catch (err) {
    console.error('❌ /state error:', err.response?.data || err.message);
    res.status(500).send('Failed to log ledger entry');
  }
});
app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});
