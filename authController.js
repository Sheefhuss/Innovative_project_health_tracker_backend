const User = require('../models/user');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const deriveFrontendUserId = (userEmail) => {
    return userEmail.split('@')[0].toLowerCase().replace(/\s/g, '-') + '-unique-id';
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};
exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body; 
        if (!email || !password || !name) {
            return res.status(400).json({ msg: 'Please enter required fields: Name, Email, and Password.' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: 'Email already registered.' });
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ 
            name, 
            email, 
            password: passwordHash,
        });
        await user.save();

        res.status(201).json({ msg: 'User created successfully. Please login.' });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ msg: 'Server error during signup.', error: err.message });
    }
};
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ msg: 'Invalid credentials: User not found.' }); 
        
        const isMatch = await bcrypt.compare(password, user.password); 
        if (!isMatch) return res.status(401).json({ msg: 'Invalid credentials: Incorrect password.' }); 
        const token = generateToken(user._id);
        const frontendUserId = deriveFrontendUserId(user.email);
        res.json({ 
            token, 
            user: { 
                userId: frontendUserId, 
                name: user.name, 
                email: user.email,
                
            } 
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ msg: 'Server error during login.', error: err.message });
    }
};
