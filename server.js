const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Crash Detection Endpoint
app.post('/api/crash-detection', (req, res) => {
    const { location, severity } = req.body;
    // TODO: Implement crash detection logic
    res.status(200).send({ message: 'Crash detection received', location, severity });
});

// Hospital Registration Endpoint
app.post('/api/hospital-registration', (req, res) => {
    const { name, address, contact } = req.body;
    // TODO: Implement hospital registration logic
    res.status(201).send({ message: 'Hospital registered', name, address, contact });
});

// Emergency Alerts Endpoint
app.post('/api/emergency-alerts', (req, res) => {
    const { alertType, message } = req.body;
    // TODO: Implement emergency alert logic
    res.status(200).send({ message: 'Emergency alert sent', alertType, message });
});

// Driver Medical Profiles Endpoint
app.post('/api/driver-medical-profile', (req, res) => {
    const { driverId, medicalHistory } = req.body;
    // TODO: Implement driver medical profile logic
    res.status(201).send({ message: 'Driver medical profile updated', driverId, medicalHistory });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
