// server/server.js
const express = require('express');
const cors = require('cors');
const { correctWord } = require('./llm-service');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/correct-word', async (req, res) => {
  try {
    const { word, context } = req.body;
    const corrected = await correctWord(word, context);
    res.json({ corrected });
  } catch (error) {
    console.error('Error correcting word:', error);
    res.status(500).json({ error: 'Failed to correct word' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});