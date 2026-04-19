require('dotenv').config(); 

const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose'); 
const bcrypt = require('bcrypt'); 
const { GoogleGenAI } = require('@google/genai');

const app = express();
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
const chatModel = 'gemini-1.5-flash';

// --- Utility Functions ---
const getCaloriesPerGram = (foodItem) => {
    const standardizedItem = foodItem.toLowerCase();
    switch (standardizedItem) {
        case 'roti':
        case 'chapati':
            return 3; 
        case 'apple':
            return 0.52;
        case 'dal':
            return 1.1;
        default:
            return 1.5;
    }
}

const deriveUserId = (userEmail) => {
    return userEmail.split('@')[0].toLowerCase().replace(/\s/g, '-') + '-unique-id';
};

// --- Database Connection ---
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    date: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const FoodLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    foodItem: { type: String, required: true },
    grams: { type: Number, required: true },
    calories: { type: Number, required: true },
    mealType: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], required: true },
    date: { type: Date, default: Date.now }
});
const FoodLog = mongoose.model('FoodLog', FoodLogSchema);

const ProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    goal: { type: String, enum: ['Maintain Weight', 'Lose Weight', 'Gain Weight'], required: true },
}, { timestamps: true });

const Profile = mongoose.model('Profile', ProfileSchema);

// --- Middleware ---
app.use(cors({
    origin: 'https://fitnesstracker44.netlify.app' 
}));
app.use(express.json()); 

// --- ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already registered.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        const userId = deriveUserId(user.email);
        res.status(200).json({ 
            user: { userId, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: 'Login failed.' });
    }
});

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, userProfile, recentFoodLogs } = req.body;
        const systemInstruction = `You are Fit AI. Profile: ${JSON.stringify(userProfile)}. Logs: ${JSON.stringify(recentFoodLogs)}.`;
        
        const model = ai.getGenerativeModel({ model: chatModel, systemInstruction });
        const result = await model.generateContent(message);
        
        res.status(200).json({ response: result.response.text() });
    } catch (error) {
        res.status(500).json({ message: 'AI Error', error: error.message });
    }
});

app.post('/api/profile/save', async (req, res) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            { userId: req.body.userId }, 
            { $set: req.body }, 
            { new: true, upsert: true }
        );
        res.status(200).json({ message: 'Profile saved.', profile });
    } catch (error) {
        res.status(500).json({ message: 'Profile save error.' });
    }
});

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.params.userId });
        if (!profile) return res.status(200).json({ name: req.params.userId.split('-')[0], age: null });
        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: 'Profile fetch error.' });
    }
});

app.post('/api/foodlog/add', async (req, res) => {
    try {
        const { userId, foodItem, grams, mealType } = req.body;
        const calories = Math.round(grams * getCaloriesPerGram(foodItem));
        const newFoodLog = new FoodLog({ userId, foodItem, grams, mealType, calories });
        await newFoodLog.save();
        res.status(201).json({ message: 'Logged!', calories });
    } catch (error) {
        res.status(500).json({ message: 'Log error.' });
    }
});

app.get('/api/foodlog/:userId', async (req, res) => {
    try {
        const logs = await FoodLog.find({ userId: req.params.userId }).sort({ date: -1 });
        res.status(200).json({ data: logs });
    } catch (error) {
        res.status(500).json({ message: 'Fetch error.' });
    }
});

app.delete('/api/foodlog/:logId', async (req, res) => {
    try {
        await FoodLog.findByIdAndDelete(req.params.logId);
        res.status(200).json({ message: 'Deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Delete error.' });
    }
});

// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
