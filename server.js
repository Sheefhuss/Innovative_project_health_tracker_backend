require('dotenv').config(); 

const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose'); 
const bcrypt = require('bcrypt'); // Required for password hashing
const { GoogleGenAI } = require('@google/genai');

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const chatModel = 'gemini-2.5-flash';

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
// Helper to derive the persistent User ID (Needed for frontend)
const deriveUserId = (userEmail) => {
    return userEmail.split('@')[0].toLowerCase().replace(/\s/g, '-') + '-unique-id';
};
// -------------------------

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- SCHEMAS ---

// 1. User Schema for Authentication (Stores email and HASHED password)
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Stores the HASH
    date: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// 2. Food Log Schema
const FoodLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    foodItem: { type: String, required: true },
    grams: { type: Number, required: true },
    calories: { type: Number, required: true },
    mealType: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], required: true },
    date: { type: Date, default: Date.now }
});
const FoodLog = mongoose.model('FoodLog', FoodLogSchema);

// 3. Profile Schema (for health data)
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

app.use(cors()); 
app.use(express.json()); 

// ==========================================================
//           1. AUTHENTICATION ROUTES (Signup & Login)
// ==========================================================

// POST /api/auth/register (Signup)
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already registered with this email.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({ name, email, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'User registered successfully. Please login.' });

    } catch (error) {
        console.error('Registration Error:', error.message);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// POST /api/auth/login (Login)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials: Email not found.' });
        }

        // 2. Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials: Incorrect password.' });
        }

        // SUCCESS: Return the custom userId and name required by the frontend
        const userId = deriveUserId(user.email);
        res.status(200).json({ 
            message: 'Login successful.', 
            user: {
                userId: userId,
                name: user.name, // Used by frontend for greeting/reminders
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login Error:', error.message);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// ==========================================================
//           2. EXISTING PROFILE AND LOGGING ROUTES
// ==========================================================

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, userProfile, recentFoodLogs } = req.body;

        const systemInstruction = `You are a helpful and supportive personal health and nutrition coach named 'Fit AI'. 
        Your responses must be short, encouraging, and actionable. 
        The user's current profile is: ${JSON.stringify(userProfile)}. 
        Their recent food logs are: ${JSON.stringify(recentFoodLogs)}. 
        Use this context to give personalized advice, especially regarding calorie intake relative to their goal.`;
        const userPrompt = `User's question: "${message}". Please provide a response.`;
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemInstruction,
            },
        });

        const aiResponse = response.text;
        res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error('Error connecting to Gemini API:', error.message);
        let errorMessage = 'Failed to get a response from the AI.';
        if (!process.env.GEMINI_API_KEY) {
            errorMessage += ' ERROR: GEMINI_API_KEY is not set in environment variables.';
        }
        res.status(500).json({ message: errorMessage, error: error.message });
    }
});

app.post('/api/profile/save', async (req, res) => {
    try {
        const { userId, name, age, height, weight, gender, goal } = req.body;
        
        if (!userId || !name || !age || !height || !weight || !gender || !goal) {
            return res.status(400).json({ message: 'Missing one or more required profile fields.' });
        }

        const profile = await Profile.findOneAndUpdate(
            { userId: userId }, 
            { $set: req.body }, 
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ message: 'Profile saved successfully.', profile });

    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ message: 'Server error during profile save.', error: error.message });
    }
});

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const profile = await Profile.findOne({ userId });

        if (!profile) {
            const namePlaceholder = userId.split('-unique-id')[0];
            return res.status(200).json({ 
                name: namePlaceholder,
                age: null, height: null, weight: null, gender: null, goal: null,
                message: "Incomplete profile. Please set up your health data."
            });
        }
        res.status(200).json(profile);

    } catch (error) {
        console.error('Error retrieving profile:', error);
        res.status(500).json({ message: 'Server error during profile fetch.', error: error.message });
    }
});

app.post('/api/foodlog/add', async (req, res) => {
    try {
        const { userId, foodItem, grams, mealType } = req.body;
        const standardizedFoodItem = foodItem.toLowerCase(); 

        const caloriesPerGram = getCaloriesPerGram(standardizedFoodItem);
        const totalCalories = Math.round(grams * caloriesPerGram);

        const newFoodLog = new FoodLog({
            userId,
            foodItem: standardizedFoodItem,
            grams,
            mealType,
            calories: totalCalories
        });

        await newFoodLog.save();
        
        res.status(201).json({
            message: `${foodItem} logged successfully!`, 
            data: newFoodLog,
            calories: totalCalories
        });

    } catch (error) {
        console.error('Error saving food log:', error);
        res.status(500).json({
            message: 'Failed to add food log.',
            error: error.message
        });
    }
});

app.get('/api/foodlog/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const logs = await FoodLog.find({ userId: userId }).sort({ date: -1 });

        if (logs.length === 0) {
            return res.status(200).json({ message: 'No food logs found for this user.', data: [] });
        }

        res.status(200).json({
            message: 'Food logs retrieved successfully!',
            data: logs
        });

    } catch (error) {
        console.error('Error retrieving food logs:', error);
        res.status(500).json({
            message: 'Failed to retrieve food logs.',
            error: error.message
        });
    }
});

app.delete('/api/foodlog/:logId', async (req, res) => {
    try {
        const logId = req.params.logId;
        const result = await FoodLog.findByIdAndDelete(logId);
        
        if (!result) {
            return res.status(404).json({ message: 'Log not found.' });
        }
        
        res.status(200).json({ message: 'Food log successfully deleted.' });
    } catch (error) {
        console.error('Error deleting food log:', error);
        res.status(500).json({ message: 'Server error during log deletion.', error: error.message });
    }
    
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});