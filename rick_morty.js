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
const hubspotSource = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_SOURCE});
const hubspotMirror= new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_MIRROR});

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
        //Obtener personajes de la API de Rick y Morty
		
        const charactersResponse = await axios.get('https://rickandmortyapi.com/api/character');
        const characters = charactersResponse.data.results;
		
        // Filtrar personajes con ID primo y migrarlos a HubSpot.
        for (const character of characters) {
			console.log("character.name:", character.name);
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
                    
                    console.log("contactProperties:", contactProperties.character_id);
                    contactId = await upsertContact(contactProperties.character_id,contactProperties,hubspotSource);
                    console.log("contactId", contactId);
                    const locationUrl = character.location.url;
                    console.log("locationUrl:", locationUrl);
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

                        console.log("companyProperties:", companyProperties.location_id);
                        // Crear o actualizar la empresa en HubSpot
                        companyId = await upsertCompany(companyProperties.location_id,companyProperties,hubspotSource);
                        console.log("companyId", companyId);
                        //Asociar el contacto con la empresa en HubSpot
                        const response= await associateContactWithCompany(contactId, companyId,hubspotSource);
                    console.log("respuesta final ", response)
                   }
				};
            }
       }
     catch (error) {
        console.error('Error al migrar personajes y ubicaciones:', error);
    }
}

async function upsertContact(characterId, properties, hubspotClient) {
  console.log("upsertContact:")
  console.log("characterId:", characterId)
  console.log("properties:", properties);
  if (characterId && properties) {
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
  
  console.log("searchRequest:", searchRequest);
  
   const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
   
  //Verifica si se encontró algún resultado y obtiene el ID del contacto
  let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;
  console.log("contactId", contactId);
  // Si se encuentra el contacto, lo actualiza; si no, crea uno nuevo
  if (contactId) {
    await hubspotClient.crm.contacts.basicApi.update(contactId, properties);
  }else {
    const createResponse = await hubspotClient.crm.contacts.basicApi.create({ 
      properties: properties
  });
    contactId = createResponse.id;
    }
    console.log("contactId de la funcion", contactId);
  
  return contactId;
}
}


async function upsertCompany(location_id, properties,hubspotClient) {
  console.log("properties upsertCompanylocation_id:", location_id);
  if (location_id && properties) { // Nos aseguramos de que tengamos datos

      const searchRequest = {
          filterGroups: [{
              filters: [{
                  propertyName: 'location_id',
                  operator: 'EQ',
                  value: location_id
              }]
          }],
          properties: ['location_id']
      };
      console.log("searchRequest:", searchRequest);

      const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch(searchRequest);
      console.log("searchResponse", searchResponse);

      let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;
      console.log("contactId:", contactId);

      // Si se encuentra la compañía, la actualiza; si no, la crea 
      if (contactId) {
          try {
              // Actualizamos solamente las propiedades recibidas
              await hubspotClient.crm.companies.basicApi.update(contactId, properties);
          } catch (error) {
              console.error(`Error al actualizar la compañía:`, error);
              // Considera si necesitas relanzar el error o devolver un valor diferente
          }
      } else {
          try {
              // Añadimos la propiedad location_id que es obligatoria
              const createResponse = await hubspotClient.crm.companies.basicApi.create({ 
                  properties: { ...properties, location_id }
              });
              contactId = createResponse.id;
          } catch (error) {
              console.error(`Error al crear la compañía:`, error);
              // Considera si necesitas relanzar el error o devolver un valor diferente
          }
      }

      return contactId; // Devolvemos el ID de la compañía
  }
}
async function associateContactWithCompany(contactId, companyId,hubspotClient) {

    console.log("contactId", contactId);
    console.log("companyId", companyId);
    if (!contactId || !companyId) { 
        console.error("Error: contactId y companyId son requeridos y deben ser válidos.");
        return; 
    }

    const BatchInputPublicAssociation = { inputs: [{"_from":{"id":contactId.toString()},"to":{"id":companyId.toString()},type: 'contact_to_company'}] };

    console.log("BatchInputPublicAssociation", BatchInputPublicAssociation);
   
    const response = await hubspotClient.crm.associations.v4.batchApi.create(

        'contacts',
        'companies',
        BatchInputPublicAssociation
    );
 
}

// Ejecutar la migración al iniciar el servidor
migrateCharactersAndLocations().then(() => {
    console.log('Migración completada');
}).catch(console.error);

const { body, validationResult } = require('express-validator');

// Definir el endpoint con validaciones
app.post('/create-or-update-contact', [
  body('character_id').isInt().withMessage('Character ID must be an integer'),
  body('character_id').not().isEmpty().withMessage('character_id is required'),
  // Agrega más validaciones según sea necesario
], async (req, res) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Procesar la solicitud si los datos son válidos
  const { character_id, ...otherProperties } = req.body;

  try {
    const contactId = await upsertContact(character_id, otherProperties,hubspotMirror);
    res.json({ success: true, message: 'Contact updated successfully', contactId });
  } catch (error) {
    console.error('Error in create-or-update-contact endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/create-or-update-company', [
    body('location_id').isInt().withMessage('Location ID must be an integer'),
    body('location_id').not().isEmpty().withMessage('location_id is required'),
    // Agrega más validaciones según sea necesario
  ], async (req, res) => {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
  
    // Procesar la solicitud si los datos son válidos
    const { location_id,  ...otherProperties } = req.body;
  
    try {
      const companyId = await upsertCompany(location_id, otherProperties,hubspotMirror);
      res.json({ success: true, message: 'Company updated successfully', companyId });
    } catch (error) {
      console.error('Error in create-or-update-company endpoint:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
const response= await associateContactWithCompany(contactId, companyId,hubspotMirror);  
  
// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


