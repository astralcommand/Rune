// index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// ====== ENV expected ======
// NOTION_TOKEN
// MASTER_TASK_DB_ID
// COUNCIL_LEDGER_DB_ID
// DIRECTORY_DB_ID   (DB Directory in Astral Command)

const NOTION_VERSION = '2022-06-28';

const notion = axios.create({
  baseURL: 'https://api.notion.com/v1/',
  headers: {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  },
});

app.use(express.json());

// ---------- utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isoDate = (d) => (d || new Date().toISOString()).split('T')[0];
const nowISO = () => new Date().toISOString();
const slug = (t) =>
  (t || 'unnamed')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

// ---------- health ----------
app.get('/', (req, res) => {
  res.send('🥳 Hello from Rune!');
});

// ---------- /summon : create a full page under a parent page ----------
app.post('/summon', async (req, res) => {
  const { title, parentId, blocks } = req.body;
  if (!parentId || !title) return res.status(400).send('Missing parentId or title');

  try {
    const { data } = await notion.post('pages', {
      parent: { type: 'page_id', page_id: parentId },
      properties: {
        // FIX: Notion requires the "title" property object, not a bare array
        title: { title: [{ text: { content: title } }] }
      },
      ...(Array.isArray(blocks) ? { children: blocks } : {})
    });

    console.log('✅ Notion page created:', data.id);
    res.status(200).json({ pageId: data.id });
  } catch (error) {
    console.error('❌ /summon error:', error.response?.data || error.message);
    res.status(500).send('Failed to create Notion page');
  }
});

// ---------- /trigger : create one or many tasks in Master Task DB ----------
app.post('/trigger', async (req, res) => {
  const DB_ID = process.env.MASTER_TASK_DB_ID;
  if (!DB_ID) return res.status(400).send('Missing MASTER_TASK_DB_ID');

  const tasks = Array.isArray(req.body) ? req.body : [req.body];

  try {
    for (const t of tasks) {
      await notion.post('pages', {
        parent: { database_id: DB_ID },
        properties: {
          "Title":           { title: [{ text: { content: t.title || 'Untitled' } }] },
          "When":            t.when ? { select: { name: t.when } } : undefined,
          "Council Members": t.councilMember ? { select: { name: t.councilMember } } : undefined,
          "Stellar Weight":  t.stellarWeight ? { select: { name: t.stellarWeight } } : undefined,
          "Time Block":      t.timeBlock ? { select: { name: t.timeBlock } } : undefined,
          "Energy Required": t.energyRequired ? { select: { name: t.energyRequired } } : undefined,
          "State of Play":   t.stateOfPlay ? { status: { name: t.stateOfPlay } } : undefined,
          "Notes":           t.notes ? { rich_text: [{ text: { content: t.notes } }] } : undefined,
        }
      });
      await sleep(120);
    }
    console.log(`✅ Created ${tasks.length} task(s) in Notion`);
    res.status(200).send(`Created ${tasks.length} task(s)`);
  } catch (err) {
    console.error('❌ /trigger error:', err.response?.data || err.message);
    res.status(500).send('Failed to create tasks');
  }
});

// ---------- /state : log a council recap into the Council Ledger ----------
app.post('/state', async (req, res) => {
  const LEDGER_DB_ID = process.env.COUNCIL_LEDGER_DB_ID;
  if (!LEDGER_DB_ID) return res.status(400).send('Missing COUNCIL_LEDGER_DB_ID');

  const entries = Array.isArray(req.body) ? req.body : [req.body];

  try {
    for (const e of entries) {
      await notion.post('pages', {
        parent: { database_id: LEDGER_DB_ID },
        properties: {
          "Title":         { title: [{ text: { content: e.title || `${e.member || 'Member'} — ${isoDate()}` } }] },
          "Member":        e.member ? { select: { name: e.member } } : undefined,
          "State of Play": (e.state || e.stateOfPlay) ? { status: { name: e.state || e.stateOfPlay } } : undefined,
          "Focus":         e.focus ? { rich_text: [{ text: { content: e.focus } }] } : undefined,
          "Blocker":       e.blocker ? { rich_text: [{ text: { content: e.blocker } }] } : undefined,
          "Next Action":   (e.next || e.nextAction) ? { rich_text: [{ text: { content: e.next || e.nextAction } }] } : undefined,
          "When":          e.when ? { select: { name: e.when } } : undefined,
          "Energy on Nova":(e.energy || e.energyOnNova) ? { select: { name: e.energy || e.energyOnNova } } : undefined,
          "Resistance":    e.resistance ? { select: { name: e.resistance } } : undefined,
          "Vibe":          (typeof e.vibe === 'number') ? { number: e.vibe } : undefined,
          "Win":           e.win ? { rich_text: [{ text: { content: e.win } }] } : undefined,
          "Reference Link":e.link ? { url: e.link } : undefined,
          "Logged At":     { date: { start: e.loggedAt ? isoDate(e.loggedAt) : isoDate() } }
        }
      });
      await sleep(120);
    }
    res.status(200).send(`Logged ${entries.length} entr${entries.length>1?'ies':'y'}.`);
  } catch (err) {
    console.error('❌ /state error:', err.response?.data || err.message);
    res.status(500).send('Failed to log ledger entry');
  }
});

// ---------- /catalog : rebuild DB Directory (auto-hydrate Property Map) ----------
app.get('/catalog', async (req, res) => {
  const DIRECTORY_DB_ID = process.env.DIRECTORY_DB_ID;
  if (!DIRECTORY_DB_ID) return res.status(400).send('Missing DIRECTORY_DB_ID');

  const upsertByDbIdOrKey = async ({ key, dbId, parentType, parentId, scope, lastEdited, propertyMap }) => {
    // try match by DB ID
    let q = await notion.post(`databases/${DIRECTORY_DB_ID}/query`, {
      filter: { property: 'DB ID', rich_text: { equals: dbId } },
      page_size: 1
    });
    let existing = q.data.results?.[0];

    if (!existing) {
      // fallback match by Key
      q = await notion.post(`databases/${DIRECTORY_DB_ID}/query`, {
        filter: { property: 'Key', title: { equals: key } },
        page_size: 1
      });
      existing = q.data.results?.[0];
    }

    const props = {
      'Key':         { title: [{ text: { content: key || 'untitled' } }] },
      'DB ID':       { rich_text: [{ text: { content: dbId } }] },
      'Parent Type': { select: { name: parentType || 'Workspace' } },
      'Parent ID':   { rich_text: [{ text: { content: parentId || '' } }] },
      'Scope':       { select: { name: scope || 'Workspace' } },
      'Last Edited': { date:   { start: lastEdited || nowISO() } },
      'Property Map':{ rich_text: [{ text: { content: propertyMap || '' } }] },
    };

    if (existing) {
      await notion.patch(`pages/${existing.id}`, { properties: props });
    } else {
      await notion.post('pages', { parent: { database_id: DIRECTORY_DB_ID }, properties: props });
    }
  };

  let cursor = undefined;
  let total = 0, createdOrUpdated = 0;

  try {
    do {
      const searchBody = {
        filter: { property: 'object', value: 'database' },
        page_size: 50,
        ...(cursor ? { start_cursor: cursor } : {})
      };
      const { data } = await notion.post('search', searchBody);
      const results = data.results || [];
      cursor = data.has_more ? data.next_cursor : null;

      for (const db of results) {
        // fetch full schema to build Property Map
        let full;
        try {
          const resp = await notion.get(`databases/${db.id}`);
          full = resp.data;
        } catch {
          // not shared with Rune; skip
          continue;
        }
        total++;

        const titlePlain = full.title?.[0]?.plain_text || 'Untitled';
        const key = slug(titlePlain);
        const parentType =
          full.parent?.type === 'workspace'   ? 'Workspace' :
          full.parent?.type === 'page_id'     ? 'Page' :
          full.parent?.type === 'database_id' ? 'Database' :
          (full.parent?.type || 'Unknown');
        const parentId   = full.parent?.page_id || full.parent?.database_id || '';
        const scope      = parentType === 'Workspace' ? 'Workspace' : 'Page';
        const lastEdited = full.last_edited_time || nowISO();

        // build Property Map JSON
        const byName = {};
        for (const [name, def] of Object.entries(full.properties || {})) {
          byName[name] = { type: def.type, name };
        }
        let propertyMap = JSON.stringify(byName, null, 2);
        if (propertyMap.length > 1800) {
          propertyMap = propertyMap.slice(0, 1790) + '\n/* trimmed */';
        }

        await upsertByDbIdOrKey({
          key, dbId: full.id, parentType, parentId, scope, lastEdited, propertyMap
        });
        createdOrUpdated++;
        await sleep(200);
      }
    } while (cursor);

    res.status(200).send(`✅ Catalog refreshed. Scanned ${total} DB(s); upserted ${createdOrUpdated}.`);
  } catch (err) {
    console.error('❌ /catalog error:', err.response?.data || err.message);
    res.status(400).send('Catalog refresh failed');
  }
});
// alias so both URLs work
app.get('/catalog/refresh', (req, res) => {
  res.redirect(307, '/catalog');
});
// ---------- optional debug: get schema for a given DB ----------
app.get('/schema/:dbId', async (req, res) => {
  try {
    const { dbId } = req.params;
    const { data } = await notion.get(`databases/${dbId}`);
    const byName = {};
    for (const [name, def] of Object.entries(data.properties || {})) {
      byName[name] = { type: def.type, name };
    }
    res.json({
      dbId,
      title: data.title?.[0]?.plain_text || '',
      properties: Object.keys(data.properties || {}),
      propertyMapByName: byName
    });
  } catch (err) {
    console.error('❌ /schema error:', err.response?.data || err.message);
    res.status(400).send('Failed to fetch schema');
  }
});
// ===== POST /write: create row(s) in ANY Notion DB by Directory Key =====
app.post('/write', async (req, res) => {
  const notion = axios.create({
    baseURL: 'https://api.notion.com/v1/',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });

  const DIRECTORY_DB_ID = process.env.DIRECTORY_DB_ID || process.env.DB_DIRECTORY_DB_ID;
  if (!DIRECTORY_DB_ID) return res.status(400).send('Missing DIRECTORY_DB_ID');

  try {
    const { key, data } = req.body; // data can be an object or an array of objects
    if (!key || !data) return res.status(400).send('Provide { key, data }');

    // 1) Find Directory row by Key (Title)
    const q = await notion.post(`databases/${DIRECTORY_DB_ID}/query`, {
      filter: { property: 'Key', title: { equals: key } },
      page_size: 1
    });
    if (!q.data.results.length) return res.status(404).send(`No Directory row with Key='${key}'`);

    const row = q.data.results[0];
    const props = row.properties || {};
    const dbId = props['DB ID']?.rich_text?.[0]?.plain_text;
    const mapText = props['Property Map']?.rich_text?.[0]?.plain_text;

    if (!dbId) return res.status(400).send(`Directory row '${key}' is missing 'DB ID'`);
    if (!mapText) return res.status(400).send(`Directory row '${key}' is missing 'Property Map'`);

    const schemaByName = JSON.parse(mapText); // { "Name": {type:"title"}, ... }

    const buildProp = (type, value) => {
      switch (type) {
        case 'title':       return { title: [{ text: { content: String(value ?? '') } }] };
        case 'rich_text':   return { rich_text: [{ text: { content: String(value ?? '') } }] };
        case 'number':      return { number: (value === '' || value === null || value === undefined) ? null : Number(value) };
        case 'date':        return { date: value ? { start: String(value) } : null };
        case 'checkbox':    return { checkbox: !!value };
        case 'url':         return { url: value ? String(value) : null };
        case 'email':       return { email: value ? String(value) : null };
        case 'phone_number':return { phone_number: value ? String(value) : null };
        case 'select':      return { select: value ? { name: String(value) } : null };
        case 'status':      return { status: value ? { name: String(value) } : null };
        case 'multi_select':
          return { multi_select: Array.isArray(value) ? value.map(v => ({ name: String(v) })) : value ? [{ name: String(value) }] : [] };
        case 'relation':
          return { relation: (Array.isArray(value) ? value : [value]).filter(Boolean).map(id => ({ id: String(id) })) };
        default:
          return undefined;
      }
    };

    const rows = Array.isArray(data) ? data : [data];
    const created = [];

    for (const item of rows) {
      const out = {};
      for (const [name, val] of Object.entries(item)) {
        const def = schemaByName[name];
        if (!def) continue;
        const built = buildProp(def.type, val);
        if (built !== undefined) out[name] = built;
      }
      const resp = await notion.post('pages', { parent: { database_id: dbId }, properties: out });
      created.push(resp.data.id);
      await new Promise(r => setTimeout(r, 150)); // gentle on rate limits
    }

    res.status(200).json({ ok: true, count: created.length, pageIds: created });
  } catch (err) {
    console.error('❌ /write error:', err.response?.data || err.message);
    res.status(400).send(err.response?.data || 'Failed to write row(s)');
  }
});
// ---------- start ----------
app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});
