# Nombre del Proyecto

Aplicación Rick y Morty para HubSpot con Heroku

## Comenzando

Estas instrucciones te permitirán obtener una copia del proyecto en funcionamiento en tu máquina local para propósitos de desarrollo y pruebas.

### Descripción

Esta aplicación permite la migración de personajes y ubicaciones de la serie Rick y Morty a HubSpot, creando contactos y empresas respectivamente, con criterios específicos.

### Funcionalidades

Migración automática de personajes y ubicaciones al iniciar el servidor.
Creación o actualización de contactos en HubSpot con información de personajes.
Creación o actualización de empresas (ubicaciones) en HubSpot.
Asociación de contactos con empresas en HubSpot.
Endpoints para la interacción manual con la aplicación.

### Tecnologías

Node.js
Express
Heroku
HubSpot API

### Prerrequisitos

Antes de comenzar, necesitarás lo siguiente:

- Node.js y npm instalados
- Cuenta de Heroku para despliegue
- Cuenta de HubSpot para obtener un API Key

### Instalación

Sigue estos pasos para instalar el proyecto:

1. Clona el repositorio:
	git clone https://github.com/IngArchyMan/Hubspot
2. Instala las dependencias del proyecto:
	npm install
3. Configura las variables de entorno necesarias para el proyecto:
	HUBSPOT_ACCESS_SOURCE=tu_api_key
	HUBSPOT_ACCESS_MIRROR=tu_api_key

## Despliegue en Heroku

Para desplegar esta aplicación en Heroku, sigue estos pasos:

1. Inicia sesión en Heroku y crea una nueva app.
2. Conecta tu repositorio de GitHub con tu aplicación de Heroku.
3. Configura las variables de entorno en Heroku.
4. Despliega la aplicación utilizando el dashboard de Heroku o a través de Heroku CLI.

## Despliegue con git

1. Agrega todas las uicaciones de tu repositorio:
	git add .
2. Actualiza todos los documentos de tu repositorio:
	git commit -m "Agrega dependencias faltantes"
1. Despliega los cambios en el servidor:
	git push heroku 
	
## Uso

Uso General
	Una vez desplegada, la aplicación permite la migración de personajes y ubicaciones de la serie Rick y Morty a HubSpot, creando contactos y empresas respectivamente en HubSpot basado en los criterios (como IDs primos y la inclusión de Rick Sanchez).

Endpoints Disponibles
	La aplicación ofrece varios endpoints para interactuar con ella:

1. Raíz (/)
	Método: GET

	Descripción: Este endpoint sirve como punto de entrada inicial y devuelve un mensaje de bienvenida.

	Uso:
	curl http://tu-dominio.com/
	
	Respuesta esperada:
	Bienvenido a la API de Rick y Morty en HubSpot
	
2. Crear o Actualizar Contacto (/create-or-update-contact)
	Método: POST

	Descripción: Permite crear o actualizar un contacto en HubSpot basado en la información de un personaje de Rick y Morty. Requiere un ID de personaje (character_id) y un conjunto de propiedades del contacto (contactProperties).

	Uso:
	curl -X POST http://tu-dominio.com/create-or-update-contact \
		 -H "Content-Type: application/json" \
		 -d '{"character_id": 1, "contactProperties": {"firstname": "Rick", "lastname": "Sanchez", "email": "rick@example.com"}}'
	
	Datos requeridos en el cuerpo de la solicitud:
	character_id: ID del personaje de Rick y Morty.
	contactProperties: Objeto que contiene las propiedades del contacto como firstname, lastname, email, etc.
	
3. Crear o Actualizar Empresa (/create-or-update-company)
Método: POST

	Descripción: Este endpoint permite crear o actualizar una empresa (ubicación en la serie) en HubSpot. Requiere un ID de ubicación (location_id) y un conjunto de propiedades de la empresa (companyProperties).

	Uso:
	curl -X POST http://tu-dominio.com/create-or-update-company \
		 -H "Content-Type: application/json" \
		 -d '{"location_id": 1, "companyProperties": {"name": "Citadel of Ricks", "dimension": "unknown"}}'

	Datos requeridos en el cuerpo de la solicitud:
	location_id: ID de la ubicación en la serie Rick y Morty.
	companyProperties: Objeto que contiene las propiedades de la empresa como name, dimension, etc.
	
Migración Automática
Además, al iniciar el servidor, la aplicación automáticamente consulta la API de Rick y Morty, filtra los personajes y sus ubicaciones basándose en ciertos criterios y migra esta información a HubSpot. No se requiere acción manual para este proceso.

## Construido con

- [Node.js](https://nodejs.org/) - El entorno de ejecución para JavaScript
- [Express](https://expressjs.com/) - El framework para aplicaciones web
- [Heroku](https://www.heroku.com/) - La plataforma de despliegue
- [HubSpot](https://app.hubspot.com/) 


## Autores

- **Jhoan Sebastian Beltran Pabon** - [IngArchyMa](https://github.com/IngArchyMan)
