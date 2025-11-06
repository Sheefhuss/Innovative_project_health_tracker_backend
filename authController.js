const User = require('../models/user');
const bcrypt = require('bcrypt'); // Using bcrypt, not bcryptjs, for consistency
const jwt = require('jsonwebtoken');

// Helper function to derive the persistent User ID (MUST match App.js logic)
const deriveFrontendUserId = (userEmail) => {
    return userEmail.split('@')[0].toLowerCase().replace(/\s/g, '-') + '-unique-id';
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// --- SIGNUP ROUTE ---
exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body; 
        
        // 1. Basic Validation
        if (!email || !password || !name) {
            return res.status(400).json({ msg: 'Please enter required fields: Name, Email, and Password.' });
        }

        // 2. Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: 'Email already registered.' });
        
        // 3. Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 4. Save new user (Using User model which should include name, email, password)
        const user = new User({ 
            name, // Assuming your UserSchema includes 'name'
            email, 
            password: passwordHash,
            // REMOVED: profile object, as it should be handled by the Profile collection later
        });
        await user.save();

        res.status(201).json({ msg: 'User created successfully. Please login.' });
    } catch (err) {
        console.error('Signup Error:', err);
        // Ensure proper Mongoose validation errors are passed
        res.status(500).json({ msg: 'Server error during signup.', error: err.message });
    }
};

// --- LOGIN ROUTE ---
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find user and validate credentials
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ msg: 'Invalid credentials: User not found.' }); // Changed 400 to 401
        
        const isMatch = await bcrypt.compare(password, user.password); 
        if (!isMatch) return res.status(401).json({ msg: 'Invalid credentials: Incorrect password.' }); // Changed 400 to 401

        // 2. Generate JWT Token
        const token = generateToken(user._id);
        
        // 3. Derive the specific userId needed by the frontend (e.g., 'kasish-unique-id')
        const frontendUserId = deriveFrontendUserId(user.email);
        
        // 4. Return necessary data to the frontend
        res.json({ 
            token, 
            user: { 
                // Return the custom ID the frontend needs for profile/log fetching
                userId: frontendUserId, 
                
                // Pass minimal profile data to App.js handleLoginSuccess
                // This name is used by App.js to check if the profile is complete.
                name: user.name, 
                email: user.email,
                
                // NOTE: All other profile data (weight, height, etc.) MUST be fetched 
                // by the frontend using GET /api/profile/:userId right after this login, 
                // which is what your frontend Login.js is already programmed to do!
            } 
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ msg: 'Server error during login.', error: err.message });
    }
};