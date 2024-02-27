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
  console.log("upsertContact:");
  console.log("characterId:", characterId);


  // Verificar si se recibió el ID del personaje
  if (!characterId) {
    console.error("Error: Falta el ID del personaje (character_id).");
    return;
  }

  // Verificar si se recibieron propiedades
  if (!properties) {
    console.error("Error: Se requieren propiedades para actualizar el contacto.");
    return;
  }

  // Verificar si la propiedad `character_id` está presente en las propiedades
  if (!properties.hasOwnProperty('character_id')) {
    console.error("Error: Falta la propiedad `character_id` en las propiedades del contacto.");
    return;
  }

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

																		  
  let contactId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;
  

  if (contactId) {
    try {
           // Actualizar solo las propiedades recibidas (excluyendo la que podría ser 'character_id')
      const propertiesToUpdate = { ...properties }; // Clona el objeto properties
      const SimplePublicObjectInput = { properties };
      // Solo actualizar si hay propiedades a cambiar:
      if (Object.keys(propertiesToUpdate).length > 0) {
        console.log("contactId", contactId);
        console.log("properties:", properties);
        await hubspotClient.crm.contacts.basicApi.update(contactId, SimplePublicObjectInput);
	      } else {
        console.warn("No se enviaron propiedades actualizables para el contacto, omitiendo actualización.")
      }		  

    } catch (error) {
      console.error(`Error al actualizar el contacto:`, error);
      // Considera si necesitas relanzar el error o devolver un valor diferente
	 
								  
    }
  } else {
    try {
      // Añadir la propiedad `character_id` que es obligatoria
      const createResponse = await hubspotClient.crm.contacts.basicApi.create({
        properties: { ...properties }
      });
      contactId = createResponse.id;
    } catch (error) {
      console.error(`Error al crear el contacto:`, error);
      // Considera si necesitas relanzar el error o devolver un valor diferente
    }
  }

  console.log("contactId de la funcion", contactId);

  return contactId;
}

async function upsertCompany(locationId, properties, hubspotClient) {
  console.log("upsertCompany:");
  console.log("locationId:", locationId);
  console.log("properties:", properties);

  // Verificar si se recibió el ID de la ubicación
  if (!locationId) {
    console.error("Error: Falta el ID de la ubicación (location_id).");
    return;
  }

  // Verificar si se recibieron propiedades
  if (!properties) {
    console.error("Error: Se requieren propiedades para actualizar la empresa.");
    return;
  }

  // Verificar si la propiedad `location_id` está presente en las propiedades
  if (!properties.hasOwnProperty('location_id')) {
    console.error("Error: Falta la propiedad `location_id` en las propiedades de la empresa.");
    return;
  }

  const searchRequest = {
    filterGroups: [{
      filters: [{
        propertyName: 'location_id',
        operator: 'EQ',
        value: locationId
      }]
    }],
    properties: ['location_id']
  };

  console.log("searchRequest:", searchRequest);

  const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch(searchRequest);

  let companyId = searchResponse.results && searchResponse.results.length > 0 ? searchResponse.results[0].id : null;
  console.log("companyId", companyId);

  if (companyId) {
    try {
      // Actualizar solo las propiedades recibidas (excluyendo la que podría ser 'location_id')
      const propertiesToUpdate = { ...properties }; // Clona el objeto properties
      const SimplePublicObjectInput = { properties };
      // Solo actualizar si hay propiedades a cambiar:
      if (Object.keys(propertiesToUpdate).length > 0) {
        await hubspotClient.crm.companies.basicApi.update(companyId, SimplePublicObjectInput);
      } else {
        console.warn("No se enviaron propiedades actualizables para la empresa, omitiendo actualización.")
      }

    } catch (error) {
      console.error(`Error al actualizar la empresa:`, error);
      // Considera si necesitas relanzar el error o devolver un valor diferente
    }
  } else {
    try {
      // Añadir la propiedad `location_id` ya que es obligatoria
      const createResponse = await hubspotClient.crm.companies.basicApi.create({
        properties: { ...properties }
      });
      companyId = createResponse.id;
    } catch (error) {
      console.error(`Error al crear la empresa:`, error);
      // Considera si necesitas relanzar el error o devolver un valor diferente
    }
  }

  console.log("companyId de la funcion", companyId);

  return companyId;
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
  const allParameters = req.body; // Capturar todos los parámetros

  // Mantén la lógica para extraer character_id de forma separada:
  const { character_id, ...otherProperties } = allParameters;

  try {
      const contactId = await upsertContact(character_id, allParameters, hubspotMirror);
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
const allParameters = req.body;
  // Procesar la solicitud si los datos son válidos
  const { location_id,  ...otherProperties } = allParameters;

  try {
    const companyId = await upsertCompany(location_id, allParameters,hubspotMirror);
    res.json({ success: true, message: 'Company updated successfully', companyId });
  } catch (error) {
    console.error('Error in create-or-update-company endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
    
// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


