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
`npm start` para servir `dist`. El build reemplaza la URL de la API y verifica
que tanto `Component.js` como `Component-preload.js` conserven las opciones de
`fetch`, sin enviar solicitudes a la API.

La ofuscación está fuera del build de producción porque transformaba el
interceptor global de `fetch` y descartaba las opciones de la petición: el login
llegaba como GET en lugar de POST y recibía un 405. No ejecutar `npm run obfuscate`
sobre el artefacto que se va a desplegar hasta corregir y validar esa transformación.

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  In order to launch the generated app, simply run the following from the generated app root folder:

```
    npm start
```

#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)


