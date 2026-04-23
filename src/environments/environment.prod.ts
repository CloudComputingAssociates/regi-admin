// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
//declare const AUTH0_DOMAIN: string;
//declare const AUTH0_CLIENT_ID: string;

declare var process: {
  env: {
    [key: string]: string | undefined
  }
};


export const environment = {
  production: false,
  auth0: {
    domain: '___AUTH0_DOMAIN___',    // Placeholder
    clientId: '___AUTH0_CLIENT_ID___', // Placeholder
    redirectUri: window.location.origin,
  },
  apiUrl: 'https://api.regimenu.net/api'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
