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
  try {
    const payload = req.body;

    const makeWebhookUrl = 'https://hook.us2.make.com/tswu2vbvrjfwj7dhxpjlu4qz1f5qjxbl'; // ← You’ll swap this once Make gives the webhook

    const response = await axios.post(makeWebhookUrl, payload);

    res.status(200).send('Page summon sent to Make');
  } catch (error) {
    console.error('Error hitting /summon route:', error.message);
    res.status(500).send('Failed to send page summon to Make');
  }
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});