## Application Details
|               |
| ------------- |
|**Generation Date and Time**<br>Fri Aug 15 2025 23:15:15 GMT-0500 (Peru Standard Time)|
|**App Generator**<br>@sap/generator-fiori-freestyle|
|**App Generator Version**<br>1.17.1|
|**Generation Platform**<br>Visual Studio Code|
|**Template Used**<br>simple|
|**Service Type**<br>None|
|**Service URL**<br>N/A|
|**Module Name**<br>registroavescombate|
|**Application Title**<br>App Title|
|**Namespace**<br>com.rprincipees|
|**UI5 Theme**<br>sap_horizon|
|**UI5 Version**<br>1.139.0|
|**Enable Code Assist Libraries**<br>False|
|**Enable TypeScript**<br>True|
|**Add Eslint configuration**<br>False|

## registroavescombate

An SAP Fiori application.

### Build de producción en Railway (rama `prd`)

Usar `npm run build:prod` con `API_BASE_URL` configurada durante el build y
`npm start` para servir `dist`. El build reemplaza la URL de la API, ofusca el
JavaScript de la aplicación y verifica el login a través del interceptor de
`fetch` en `Component.js` y `Component-preload.js`, sin solicitudes a la API.

La ofuscación conserva las firmas de las llamadas y los nombres de propiedades
usados por UI5. `controlFlowFlattening`, `deadCodeInjection` y
`stringArrayCallsTransform` están desactivados para evitar que se pierdan opciones
de las peticiones. Se conservan la compactación, el renombrado de variables
locales y las cadenas codificadas, con una semilla fija para builds reproducibles.
Las bibliotecas UI5 no se ofuscan; los `.ts` y mapas de fuentes de la aplicación
se retiran únicamente de `dist`. La comprobación final bloquea el despliegue si
el login deja de enviar POST, cabeceras o cuerpo JSON.

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  In order to launch the generated app, simply run the following from the generated app root folder:

```
    npm start
```

#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)


