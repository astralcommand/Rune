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

app.post('/trigger', async (req, res) => {
  const {
    title = "Untitled Task",
    dueDate = new Date().toISOString(),
    councilMember = "Unassigned",
    stellarWeight = "Nebula",
    stateOfPlay = "Idle",
    notes = "",
    originalGlyph = "Nova"
  } = req.body;

  const makeWebhookUrl = 'https://hook.us2.make.com/t1mfeiv5rutglvxjbn0xcmt8tavr1v4o';

  const payload = {
    title,
    dueDate,
    councilMember,
    stellarWeight,
    stateOfPlay,
    notes,
    originalGlyph
  };

  try {
    const response = await axios.post(makeWebhookUrl, payload);
    console.log("Successfully sent task to Make webhook.");
    res.status(200).send("Webhook triggered.");
  } catch (error) {
    console.error("Error sending to Make webhook:", error.message);
    res.status(500).send("Failed to send to Make.");
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

  // Trigger Make webhook as soon as Rune starts
  axios.post(`http://localhost:${PORT}/trigger`)
    .then(() => console.log("Local /trigger route hit successfully."))
    .catch(err => console.error("Error hitting /trigger route:", err.message));
});