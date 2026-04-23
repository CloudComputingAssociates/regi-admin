import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Regi Admin';
  isAdmin$: Observable<boolean>;

  constructor(public auth: AuthService) {
    this.isAdmin$ = this.auth.isAuthenticated$.pipe(
      switchMap(isAuth => {
        if (!isAuth) return of(false);
        return this.auth.getAccessTokenSilently().pipe(
          map(token => {
            try {
              const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
              const roles: string[] = payload['https://api.regimenu.net/roles'] || [];
              return roles.includes('Admin');
            } catch {
              return false;
            }
          }),
          catchError(() => of(false))
        );
      })
    );
  }
}
