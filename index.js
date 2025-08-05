// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

// ===== GET / =====
app.get('/', (req, res) => {
  res.send('🥳 Hello from Rune!');
});

// ===== POST /summon =====
app.post('/summon', async (req, res) => {
  // simple echo test for now
  console.log('✅ /summon payload:', req.body);
  res.status(200).json({ received: req.body });
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});