const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Rune server is alive on port ' + PORT);
});

// ========== /trigger route for sending tasks to Notion database ==========
app.post('/trigger', async (req, res) => {
  try {
    const payload = req.body;

    const makeWebhookUrl = 'https://hook.us2.make.com/tswu2vbvrjfwj7dhxpjlu4qz1f5qjxbl'; // ← Your task list webhook

    const response = await axios.post(makeWebhookUrl, payload);

    res.status(200).send('Task payload sent to Make');
  } catch (error) {
    console.error('Error hitting /trigger route:', error.message);
    res.status(500).send('Failed to send task payload to Make');
  }
});

// ========== /summon route for creating Notion pages ==========
app.post('/summon', async (req, res) => {
  const { title, parentPageId, children } = req.body;

  const notionHeaders = {
    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Create the page
    const createPageResponse = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { page_id: parentPageId },
        properties: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      { headers: notionHeaders }
    );

    const pageId = createPageResponse.data.id;

    // Step 2: Append the children blocks
    if (children && children.length > 0) {
      await axios.patch(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        {
          children: children,
        },
        { headers: notionHeaders }
      );
    }

    res.status(200).send(`Page '${title}' created and blocks added.`);
  } catch (error) {
    console.error('Error in /summon:', error.response?.data || error.message);
    res.status(500).send('Failed to summon page.');
  }
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});