// index.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const WEBHOOK_URL = 'https://hook.us2.make.com/t1mfeiv5rutglvxjbn0xcmt8tavr1v4o';

// Example payload — Rune will send this when triggered
const payload = {
  task: "Call SNHU advising",
  assignedTo: "Quill",
  urgency: "High",
  category: "School"
};

app.get('/', (req, res) => {
  res.send('Rune server is listening. 👁️‍🗨️🖤');
});

app.post('/trigger', async (req, res) => {
  try {
    await axios.post(WEBHOOK_URL, payload);
    res.status(200).send('Payload sent to Make successfully.');
  } catch (error) {
    console.error('Error sending webhook:', error.message);
    res.status(500).send('Failed to send payload.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});