require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const hubspot = require('@hubspot/api-client');

const app = express();
app.use(bodyParser.json());

// Agrega esta sección para manejar solicitudes GET a la raíz "/"
app.get('/', (req, res) => {
  res.send('Bienvenido a la API de Rick y Morty en HubSpot');
});																   
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// Función para crear/actualizar contactos y devolver el ID del contacto
async function upsertContact(email, properties) {
    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [{
            filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email
            }]
        }],
        properties: ['email']
    });

    let contactId = searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

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

// Función para asociar contactos con empresas
async function associateContactWithCompany(contactId, companyId) {
    await hubspotClient.crm.associations.batchApi.create('contact', 'company', {
        inputs: [{ from: { id: contactId }, to: { id: companyId }, type: "company_to_contact" }]
    });
}

// Endpoint para actualizar contactos y asociarlos con empresas
app.post('/update-contact', async (req, res) => {
    const { email, contactProperties, companyName, companyProperties } = req.body;

    try {
        const contactId = await upsertContact(email, contactProperties);
        const companyId = await upsertCompany(companyName, companyProperties);
        await associateContactWithCompany(contactId, companyId);

        res.json({ success: true, message: 'Contact and company updated and associated successfully' });
    } catch (error) {
        console.error('Error in update-contact endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
