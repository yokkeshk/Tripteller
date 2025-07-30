
const express = require('express');
const router = express.Router();
const Search = require('../models/Search');

// Save a search record
router.post('/', async (req, res) => {
  try {
    const { userId, origin, destination, distance } = req.body;
    const newSearch = new Search({ userId, origin, destination, distance });
    await newSearch.save();
    res.status(201).json(newSearch);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save search' });
  }
});

// Get search history for a user
router.get('/:userId', async (req, res) => {
  try {
    const history = await Search.find({ userId: req.params.userId }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
