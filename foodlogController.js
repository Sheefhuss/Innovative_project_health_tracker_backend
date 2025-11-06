const FoodLog = require('../models/foodLog');
const FOOD_CALORIES = require('../data/foodData');

exports.addFoodLog = async (req, res) => {
  try {
    const { foodItem, grams, userId, mealType } = req.body;

    if (!foodItem || !grams || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const caloriesPer100g = FOOD_CALORIES[foodItem.toLowerCase()];
    if (!caloriesPer100g) {
      return res.status(400).json({ message: 'Food item not found' });
    }

    const calories = (grams / 100) * caloriesPer100g;

    const newLog = new FoodLog({ userId, foodItem, grams, calories, mealType });
    await newLog.save();

    res.status(201).json({ message: 'Food log added', log: newLog });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
