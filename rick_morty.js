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
		
        const charactersResponse = await axios.get('https://rickandmortyapi.com/api/character');
        const characters = charactersResponse.data.results;
		
        // Filtrar personajes con ID primo y migrarlos a HubSpot
        for (const character of characters) {
			console.log("character.name:", character.name);
            let contactProperties;
            
            if (isPrime(character.id) || character.name === "Rick Sanchez") { // Incluir a Rick Sanchez con ID 1
                
                 contactProperties = {
                    firstname: character.name.split(' ')[0],
                    lastname: character.name.split(' ').slice(1).join(' ') || character.name,
					character_id: character.id,
                    character_gender: character.gender,
                    status_character: character.status,
					character_species :character.species,
					};
                    
                    console.log("contactProperties:", contactProperties.character_id);
                    const contactId = await upsertContact(contactProperties.character_id,contactProperties);
                    const locationUrl = character.location.url;
                    console.log("locationUrl:", locationUrl);
                    let companyProperties;
                    if (locationUrl) {
                        const locationResponse = await axios.get(locationUrl);
                        const location = locationResponse.data;
                        
    
                        // Mapear datos de la ubicación a propiedades de empresa en HubSpot
                        companyProperties = {
                            name: location.name,
                            dimension:location.dimension,
                            location_id: location.id,
                            creation_date:location.created,
                            location_type:location.type		
                        };
                        console.log("companyProperties:", companyProperties.location_id);
                        // Crear o actualizar la empresa en HubSpot
                        const companyId = await upsertCompany(companyProperties.location_id,companyProperties);
    
                        // Asociar el contacto con la empresa en HubSpot
                        // const response= await associateContactWithCompany(contactId, companyId);
                        // console.log(response)
                    }
				};
            }
       }
     catch (error) {
        console.error('Error al migrar personajes y ubicaciones:', error);
    }
}

async function upsertContact(characterId, properties) {
  console.log("upsertContact:")
  console.log("characterId:", characterId)
  console.log("properties:", properties);
  
  const searchRequest = {
    filterGroups: [{
      filters: [{
        propertyName: 'character_id', // Make sure this is the correct property name.
        operator: 'EQ',
        value: characterId
      }]
    }],
    properties: ['character_id']
  };
  
  console.log("searchRequest:", searchRequest);
  
   const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
   console.log("earchResponse:", searchResponse);
  //Verifica si se encontró algún resultado y obtiene el ID del contacto
  let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

  // Si se encuentra el contacto, lo actualiza; si no, crea uno nuevo
  if (contactId) {
    await hubspotClient.crm.contacts.basicApi.update(contactId, properties);
  } else {
    const createResponse = await hubspotClient.crm.contacts.basicApi.create({ properties: properties });
    contactId = createResponse.id;
    console.log("contactId:", contactId);
  }

  return contactId;
}
   


async function upsertCompany(location_id, properties) {
    console.log("properties upsertCompanylocation_id:", location_id);
     const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName:'location_id', // Make sure this is the correct property name.
            operator: 'EQ',
            value: location_id
          }]
        }],
        properties:['location_id']
      };
      console.log("searchRequest:", searchRequest);
  
    const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch(searchRequest);  
    // Realizar la búsqueda del contacto en HubSpot usando el location_id
    console.log("earchResponse:", searchResponse);
    let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

    // Si se encuentra el contacto, lo actualiza; si no, crea uno nuevo
    if (contactId) {
      await hubspotClient.crm.companies.basicApi.update(contactId, properties);
    } else {
      const createResponse = await hubspotClient.crm.companies.basicApi.create({ properties: properties });
      contactId = createResponse.id;
      console.log("contactId:", contactId);
    }
  
    return contactId;
}
async function associateContactWithCompany(contactId, companyId) {
    const BatchInputPublicAssociation = {
        inputs: [
            {
                _from: {
                    id : contactId
                },
                to: {
                    id: companyId
                },
                type: 'contact_to_company'
            }
        ]
    };
    
    const response = await hubspotClient.crm.associations.batchApi.create(
        'contact',
        'companies',
        BatchInputPublicAssociation
    );
    return response;
}
// Ejecutar la migración al iniciar el servidor
migrateCharactersAndLocations().then(() => {
    console.log('Migración completada :D');
}).catch(console.error);

// Endpoint para crear o actualizar un contacto
app.post('/create-or-update-contact', async (req, res) => {
    const { character_id, contactProperties } = req.body;

    try {
        const contactId = await upsertContact(character_id,contactProperties);
        res.json({ success: true, message: 'Contact updated successfully', contactId });
    } catch (error) {
        console.error('Error in create-or-update-contact endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint para crear o actualizar una ubicación (company)
app.post('/create-or-update-company', async (req, res) => {
const {location_id, companyProperties } = req.body;

    try {
    const companyId = await upsertCompany(location_id,companyProperties);
        res.json({ success: true, message: 'Location updated successfully', companyId });
    } catch (error) {
        console.error('Error in create-or-update-location endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});









