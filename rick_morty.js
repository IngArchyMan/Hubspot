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
		
        // Filtrar personajes con ID primo y migrarlos a HubSpot.
        for (const character of characters) {
			//console.log("character.name:", character.name);
            let contactProperties;
            let contactId;
            let companyId;
            if (character && (isPrime(character.id) || character.name === "Rick Sanchez")) { // Incluir a Rick Sanchez con ID 1
                
                 contactProperties = {
                    firstname: character.name.split(' ')[0],
                    lastname: character.name.split(' ').slice(1).join(' ') || character.name,
					character_id: character.id,
                    character_gender: character.gender,
                    status_character: character.status,
					character_species :character.species,
					};
                    
                    //console.log("contactProperties:", contactProperties.character_id);
                    contactId = await upsertContact(contactProperties.character_id,contactProperties);
                    //console.log("contactId", contactId);
                    const locationUrl = character.location.url;
                    //console.log("locationUrl:", locationUrl);
                    let companyProperties;
                    if (locationUrl) {
                        const locationResponse = await axios.get(locationUrl);
                        const location = locationResponse.data;

                        companyProperties = {
                            name: location.name,
                            dimension:location.dimension,
                            location_id: location.id,
                            creation_date:location.created,
                            location_type:location.type		
                        };

                        //console.log("companyProperties:", companyProperties.location_id);
                        // Crear o actualizar la empresa en HubSpot
                        companyId = await upsertCompany(companyProperties.location_id,companyProperties);
                        //console.log("companyId", companyId);
                        //Asociar el contacto con la empresa en HubSpot
                        const response= await associateContactWithCompany(contactProperties.character_id, companyProperties.location_id);
                    //console.log("respuesta final ", response)
                   }
				};
            }
       }
     catch (error) {
        console.error('Error al migrar personajes y ubicaciones:', error);
    }
}

async function upsertContact(characterId, properties) {
  //console.log("upsertContact:")
  //console.log("characterId:", characterId)
  //console.log("properties:", properties);
  if(characterId != null && properties != ''){
  const searchRequest = {
    filterGroups: [{
      filters: [{
        propertyName: 'character_id', 
        operator: 'EQ',
        value: characterId
      }]
    }],
    properties: ['character_id']
  };
  
  //console.log("searchRequest:", searchRequest);
  
   const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
   //console.log("earchResponse:", searchResponse);
  //Verifica si se encontró algún resultado y obtiene el ID del contacto
  let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

  // Si se encuentra el contacto, lo actualiza; si no, crea uno nuevo
  if (contactId) {
    await hubspotClient.crm.contacts.basicApi.update(contactId, properties);
  }else {
    const createResponse = await hubspotClient.crm.contacts.basicApi.create({ properties: properties});
    contactId = createResponse.id;
    }
    //console.log("contactId de la funcion", contactId);
  
  return contactId;
}
}
   


async function upsertCompany(location_id, properties) {
    //console.log("properties upsertCompanylocation_id:", location_id);
    if(location_id != null && properties != ''){
     const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName:'location_id', 
            operator: 'EQ',
            value: location_id
          }]
        }],
        properties:['location_id']
      };
      //console.log("searchRequest:", searchRequest);
  
    const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch(searchRequest);  
    // Realizar la búsqueda del contacto en HubSpot usando el location_id
    //console.log("earchResponse:", searchResponse);
    let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;

    // Si se encuentra el contacto, lo actualiza; si no, crea uno nuevo
    if (contactId) {
      await hubspotClient.crm.companies.basicApi.update(contactId, properties);
    } else {
     
      const createResponse = await hubspotClient.crm.companies.basicApi.create({ properties: properties });
      contactId = createResponse.id;
      }
      
    return contactId;
}
}
async function associateContactWithCompany(contactId, companyId) {



    if (!contactId || !companyId) { 
        console.error("Error: contactId y companyId son requeridos y deben ser válidos.");
        return; 
    }


    const BatchInputPublicAssociation = {
        inputs: [
            {
                from: {
                    id: contactId
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
    //console.log('Migración completada');
}).catch(console.error);

const { body, validationResult } = require('express-validator');

// Definir el endpoint con validaciones
app.post('/create-or-update-contact', [
  body('character_id').isInt().withMessage('Character ID must be an integer'),
  body('contactProperties.firstname').not().isEmpty().withMessage('First name is required'),
  body('contactProperties.lastname').not().isEmpty().withMessage('Last name is required'),
  // Agrega más validaciones según sea necesario
], async (req, res) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Procesar la solicitud si los datos son válidos
  const { character_id, contactProperties } = req.body;

  try {
    const contactId = await upsertContact(character_id, contactProperties);
    res.json({ success: true, message: 'Contact updated successfully', contactId });
  } catch (error) {
    console.error('Error in create-or-update-contact endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/create-or-update-company', [
    body('location_id').isInt().withMessage('Location ID must be an integer'),
    body('companyProperties.name').not().isEmpty().withMessage('Company name is required'),
    // Agrega más validaciones según sea necesario
  ], async (req, res) => {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
  
    // Procesar la solicitud si los datos son válidos
    const { location_id, companyProperties } = req.body;
  
    try {
      const companyId = await upsertCompany(location_id, companyProperties);
      res.json({ success: true, message: 'Location updated successfully', companyId });
    } catch (error) {
      console.error('Error in create-or-update-company endpoint:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    //console.log(`Server is running on port ${PORT}`);
});









