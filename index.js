// index.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Replace this with your actual Make webhook URL
const WEBHOOK_URL = 'https://hook.us2.make.com/t1mfeiv5rutglvxjbn0xcmt8tavr1v4o';

// Home route to verify server status
app.get('/', (req, res) => {
  res.send('Rune server is listening. 👁️‍🗨️🖤');
});

// Static task trigger route (preset payload)
app.post('/trigger', async (req, res) => {
  const payload = {
    task: "Call SNHU advising",
    assignedTo: "Quill",
    urgency: "High",
    category: "School"
  };

  try {
    await axios.post(WEBHOOK_URL, payload);
    res.status(200).send('Preset payload sent to Make successfully.');
  } catch (error) {
    console.error('Error sending static webhook:', error.message);
    res.status(500).send('Failed to send preset payload.');
  }
});

// Dynamic payload forwarder route
app.post('/rune', async (req, res) => {
  const data = req.body;

  try {
    const response = await axios.post(WEBHOOK_URL, data);
    console.log('✅ Forwarded dynamic data to Make:', response.status);
    res.status(200).send('Dynamic payload sent to Make successfully.');
  } catch (error) {
    console.error('❌ Error sending to Make:', error.message);
    res.status(500).send('Failed to forward dynamic payload.');
  }
});

// Port binding (for Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});