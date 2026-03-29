const mongoose = require('mongoose');

// Driver Schema
const driverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    vehicleDetails: { type: String, required: true },
    contactNumber: { type: String, required: true },
    availability: { type: Boolean, default: true }
});

// Hospital Schema
const hospitalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    contactNumber: { type: String, required: true },
    emergencyServices: { type: Boolean, default: true }
});

// Emergency Alert Schema
const emergencyAlertSchema = new mongoose.Schema({
    location: { type: String, required: true },
    time: { type: Date, default: Date.now },
    alertType: { type: String, required: true },
    status: { type: String, default: 'pending' }
});

// Medical Profile Schema
const medicalProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    allergies: { type: [String], default: [] },
    medicalConditions: { type: [String], default: [] },
    medications: { type: [String], default: [] },
    emergencyContact: { type: String, required: true }
});

// Export the models
module.exports = {
    Driver: mongoose.model('Driver', driverSchema),
    Hospital: mongoose.model('Hospital', hospitalSchema),
    EmergencyAlert: mongoose.model('EmergencyAlert', emergencyAlertSchema),
    MedicalProfile: mongoose.model('MedicalProfile', medicalProfileSchema)
};