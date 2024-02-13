require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const hubspot = require('@hubspot/api-client');
const axios = require('axios');																									  

const app = express();
app.use(bodyParser.json());


app.get('/', (req, res) => {
  res.send('Bienvenido a la API de Rick y Morty en HubSpot');
});																   
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// Función auxiliar para verificar si un número es primo
function isPrime(num) {
    for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) return false;
    }
    return num > 1;
}
// Función para consultar la API de Rick y Morty y migrar personajes y ubicaciones
async function migrateCharactersAndLocations() {
     try {
        // Obtener personajes de la API de Rick y Morty
		console.log('migrateCharactersAndLocations');
        const charactersResponse = await axios.get('https://rickandmortyapi.com/api/character');
        const characters = charactersResponse.data.results;

        // Filtrar personajes con ID primo y migrarlos a HubSpot
        for (const character of characters) {
            if (isPrime(character.id) || character.id === 1) { // Incluir a Rick Sanchez con ID 1
                // Mapear datos del personaje a propiedades de contacto en HubSpot
                const contactProperties = {
                    email: `${character.name.toLowerCase().split(' ').join('.')}@rickandmorty.com`,
                    firstname: character.name.split(' ')[0],
                    lastname: character.name.split(' ').slice(1).join(' ') || character.name,
                    // Otros mapeos según sea necesario
                };
				console.log("contactProperties.email:", contactProperties.email);
				console.log("contactProperties:", contactProperties)
				// Crear o actualizar el contacto en HubSpot
				const contactId = await upsertContact(contactProperties.email, contactProperties);
                // Obtener y migrar la ubicación asociada al personaje
                const locationUrl = character.location.url
				console.log("locationUrl:", locationUrl);
                if (locationUrl) {
                    const locationResponse = await axios.get(locationUrl);
                    const location = locationResponse.data;
					console.log("locationResponse",locationResponse);
					console.log("location" ,location);
					

                    // Mapear datos de la ubicación a propiedades de empresa en HubSpot
                    const companyProperties = {
                        name: location.name,
                    };

                    // Crear o actualizar la empresa en HubSpot
                    const companyId = await upsertCompany(location.name, companyProperties);

                    // Asociar el contacto con la empresa en HubSpot
                    await associateContactWithCompany(contactId, companyId);
                }
            }
        }
    } catch (error) {
        console.error('Error al migrar personajes y ubicaciones:', error);
    }
}
async function upsertContact(email, properties) {
  // Verificar que el email no sea undefined o un string vacío
  if (!email) {
    console.error('El email proporcionado es inválido:', email);
    return; // Salir de la función si el email no es válido
  }

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

  let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

  if (contactId) {
    await hubspotClient.crm.contacts.basicApi.update(contactId, { properties });
  } else {
    const createResponse = await hubspotClient.crm.contacts.basicApi.create({ properties: { email, ...properties } });
    contactId = createResponse.id;
  }

  return contactId;
}
   


// Función para crear/actualizar empresas y devolver el ID de la empresa
async function upsertCompany(name, properties) {
	console.log('upsertCompany');
    const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch({
        filterGroups: [{
            filters: [{
                propertyName: 'name',
                operator: 'EQ',
                value: name
            }]
        }],
        properties: ['name']
    });

    let companyId = searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

    if (companyId) {
        await hubspotClient.crm.companies.basicApi.update(companyId, { properties });
    } else {
        const createResponse = await hubspotClient.crm.companies.basicApi.create({ properties: { name, ...properties } });
        companyId = createResponse.id;
    }
   

    return companyId;
}

// Ejecutar la migración al iniciar el servidor
migrateCharactersAndLocations().then(() => {
    console.log('Migración completada');
}).catch(console.error);

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
app.post('/create-or-update-company', async (req, res) => {
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
