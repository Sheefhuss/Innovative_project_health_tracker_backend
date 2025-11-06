
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true, 
    },
    name: {
        type: String,
        required: true,
    },
    age: {
        type: Number,
        required: true,
    },
    height: {
        type: Number,
        required: true,
    },
    weight: {
        type: Number, 
        required: true,
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: true,
    },
    goal: {
        type: String,
        enum: ['Maintain Weight', 'Lose Weight', 'Gain Weight'],
        required: true,
    },
}, { timestamps: true });
module.exports = mongoose.model('Profile', ProfileSchema);
