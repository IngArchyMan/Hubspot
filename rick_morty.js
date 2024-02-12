require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const hubspot = require('@hubspot/api-client');

const app = express();
app.use(bodyParser.json());

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// ... (Las funciones upsertContact y upsertCompany se mantienen iguales)

// Endpoint para crear o actualizar un contacto
app.post('/create-or-update-contact', async (req, res) => {
    const { email, contactProperties } = req.body;

    try {
        const contactId = await upsertContact(email, contactProperties);
        res.json({ success: true, message: 'Contact updated successfully', contactId });
    } catch (error) {
        console.error('Error in create-or-update-contact endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint para crear o actualizar una ubicación (company)
app.post('/create-or-update-location', async (req, res) => {
    const { name, companyProperties } = req.body;

    try {
        const companyId = await upsertCompany(name, companyProperties);
        res.json({ success: true, message: 'Location updated successfully', companyId });
    } catch (error) {
        console.error('Error in create-or-update-location endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ... (La función associateContactWithCompany se mantiene igual)

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
