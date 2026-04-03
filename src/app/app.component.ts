import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Foods App';

  isAuthenticated$ = this.auth.isAuthenticated$;

  // Check for Admin role in the access token's custom claims
  isAdmin$ = this.auth.getAccessTokenSilently().pipe(
    map(token => {
      try {
        // Decode JWT payload (base64url)
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const roles: string[] = payload['https://yehapi.cloudcomputingassociates.net/roles'] || [];
        return roles.includes('Admin');
      } catch {
        return false;
      }
    })
  );

  constructor(public auth: AuthService) {}
}
