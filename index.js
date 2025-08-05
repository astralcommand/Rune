// index.js
require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('🥳 Hello from Rune!');
});

app.listen(PORT, () => {
  console.log(`Rune server is alive on port ${PORT}`);
});