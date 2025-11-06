const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile'); 
router.post('/save', async (req, res) => {
    try {
        const { userId, name, age, height, weight, gender, goal } = req.body;
        
        if (!userId || !name || !age || !height || !weight) {
            return res.status(400).json({ message: 'Missing required profile fields.' });
        }
        const profile = await Profile.findOneAndUpdate(
            { userId: userId },
            { $set: req.body }, 
            { new: true, upsert: true } 
        );
        res.status(200).json({ message: 'Profile saved successfully.', profile });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error during profile save.' });
    }
});
router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const profile = await Profile.findOne({ userId });

        if (!profile) {
            return res.status(200).json({ 
                message: "Profile not found, please complete setup.",
                profile: { 
                    name: userId.split('-unique-id')[0], // Use part of ID as name placeholder
                    age: null, height: null, weight: null, gender: null, goal: null
                }
            });
        }

        res.status(200).json(profile);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error during profile fetch.' });
    }
});

module.exports = router;