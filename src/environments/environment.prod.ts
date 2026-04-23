// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: true,
  auth0: {
    domain: 'dev-sj1bmj8255bwte7r.us.auth0.com',
    clientId: '9KHWGCfSSg9wUr1oREiUYIgP15EDIppJ',
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
