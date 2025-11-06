const mongoose = require('mongoose');

const foodLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  foodItem: { type: String, required: true },
  grams: { type: Number, required: true },
  calories: { type: Number, required: true },
  mealType: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FoodLog', foodLogSchema);

