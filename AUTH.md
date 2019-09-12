# Auth logic

## API

For GraphQL queries authentication is performed by GraphQL API itself, using `login` and `signUp`

From this queries/mutations you get `access_token` and `refresh_token`.
First is needed to use GraphQL authenticated queries, it must be set in headers in form `Authentication: Bearer <access_token>`.
The latter is used to refresh expired `access_token`, `refreshTokens` does this logic.

## Social auth

Supported OAuth 2.0 providers:
- GitHub
- Google

### Login

Login follows OAuth 2.0 specification:

1. User goes to `/auth/<provider>`
2. API redirects to OAuth 2.0 provider login link, e.g. `http://provider.com/auth?callback_url=...&state=...`
3. User accepts login request on consent screen.
4. Provider redirects to `/auth/<provider>/callback`
5. API searches or inserts a user matching the provider's user id.
6. API redirects to Garage login page with `access_token` and `refresh_token` in GET query.
7. Garage sets tokens to store and uses them.

### Linking

1. Garage sends request to `/auth/init` with token in headers. This route sets user id in cookie session, 
it is needed to get the user who performed linking on last phase.
2. Garage redirects to `/auth/<provider>/link`.
3. API sets action = link to session and redirects to provider login link (like in login stage 2).
4. User accepts login request on consent screen.
5. Provider redirects to `/auth/<provider>/callback`
6. API gets user id and action from session, performs linking in database, destroys session, redirects to Garage.

### CSRF protection

- When API redirects to provider login page it uses [PKCE flow](https://oauth.net/2/pkce/), which prevents from CSRF attacks
So an attacker can't exploit account linking via giving user provider login page url
- Session(cookie) destroys after every link/unlink
- A separate route `/auth/init` is used to set session user id from JWT token
