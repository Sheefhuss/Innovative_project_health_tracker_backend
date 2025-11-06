const express = require('express');
const router = express.Router();
const { addFoodLog, getAllFoodLogs, getFoodLog, updateFoodLog, deleteFoodLog } = require('../controllers/foodlogController');

router.post('/add', addFoodLog);
router.get('/all', getAllFoodLogs);
router.get('/:id', getFoodLog);
router.put('/:id', updateFoodLog);
router.delete('/:id', deleteFoodLog);

module.exports = router;
