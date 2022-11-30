# Impersonation service
A microservice that allows users to impersonate other users.

## Tutorials
### Add the impersonation-service to a stack
Add the following snippet to your `docker-compose.yml` file to include the impersonation service in your project.

```yml
impersonation:
  image: kanselarij/impersonation-service
```

Add rules to the `dispatcher.ex` to dispatch requests to the impersonation service.

```ex
get "/who-am-i/*_path", @json_service do
  Proxy.forward conn, [], "http://impersonation/who-am-i/"
end

post "/impersonate/*_path", @json_service do
  Proxy.forward conn, [], "http://impersonation/impersonate/"
end

delete "/impersonate/*_path", @json_service do
  Proxy.forward conn, [], "http://impersonation/impersonate/"
end
```

To use this service (some of) the users will need write access to the `http://mu.semte.ch/graphs/sessions` graph.
You will also need to add a way to differentiate access for users and users impersonating another user.

For example, you could have a regular way to determine access based on membership role. When impersonating a user,
you will automatically receive the data you'd expect to see if you were logged in as the impersonated user. But for
some operations, like writing session data, you would want to use the role that's linked to the impersonating user.

```ex
defp access_by_role(role_uris) do
  %AccessByQuery{
    vars: [],
    query: "PREFIX org: <http://www.w3.org/ns/org#>
            PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
            SELECT ?role_uri WHERE {
              <SESSION_ID> ext:sessionMembership / org:role ?role_uri .
              VALUES ?role_uri { #{Enum.join(role_uris, " ")} }
            } LIMIT 1"
  }
end

defp access_by_own_role(role_uris) do
  %AccessByQuery{
    vars: [],
    query: "PREFIX org: <http://www.w3.org/ns/org#>
            PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
            SELECT ?role_uri WHERE {
              OPTIONAL { <SESSION_ID> ext:impersonatorMembership ?maybeOwnMembership }
              <SESSION_ID> ext:sessionMembership ?impersonatedOrOwnMembership .
              BIND(COALESCE(?maybeOwnMembership, ?impersonatedOrOwnMembership) AS ?membership)
              ?membership org:role ?role_uri .
              VALUES ?role_uri { #{Enum.join(role_uris, " ")} }
            } LIMIT 1"
  }
end

# [...]

def user_groups do
  [
    %GroupSpec{
      name: "admin",
      useage: [:read, :write, :read_for_write],
      access: access_by_own_role(admin_roles()),
      graphs: [
        %GraphSpec{
          graph: "http://mu.semte.ch/graphs/sessions",
          constraint: %ResourceFormatConstraint{
            resource_prefix: "http://mu.semte.ch/sessions/"
          }
        },
      ]
    },
  ]
end
```

## Reference
### Data model

Each logged in user has a session stored in the triplestore. This service works on the assumption that sessions are stored as follows:

```nq
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/session/account> <http://example.com/account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/sessionMembership> <http://example.com/membership-id> <http://mu.semte.ch/graphs/sessions> .
```

The service works by replacing the linked account and membership of a user's session with the account and membership of the user
we want to impersonate. The original user's data are stored as follows:

```nq
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/impersonator> <http://example.com/original-account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/impersonatorMembership> <http://example.com/original-membership-id> <http://mu.semte.ch/graphs/session> .
```

### API
#### GET `/who-am-i`

Fetch the account info linked to the real user of the current session. It will return the account and membership of the logged in user, not the impersonated user.

#### Response
##### 200 OK

```json
{
  "data": {
    "type": "sessions",
    "id": "session-id",
    "relationships": {
      "account": {
        "links": "/accounts/account-id",
        "data": { "type": "accounts", "id": "account-id" }
      },
      "membership": {
        "links": "/accounts/membership-id",
        "data": { "type": "memberships", "id": "membership-id" }
      }
    }
  },
  "links": {
    "self": "/who-am-i"
  }
}
```

#### POST `/impersonate`

As the current session, impersonate the provided role. 
#### Request body

```json
{
  "data": {
    "type": "sessions",
    "relationships": {
      "role": {
        "data": { "type": "roles", "id": "role-id"}
      }
    }
  }
}
```

#### Response
##### 200 OK

```json
{
  "data": {
    "type": "sessions",
    "id": "session-id",
    "relationships": {
      "account": {
        "links": "/accounts/account-id",
        "data": { "type": "accounts", "id": "original-account-id" }
      },
      "membership": {
        "links": "/accounts/membership-id",
        "data": { "type": "memberships", "id": "original-membership-id" }
      }
    }
  },
  "links": {
    "self": "/who-am-i"
  }
}
```

##### 400 Bad Request
- If the account or membership are missing from the request body

##### 403 Forbidden
- If the user does not have the necessary authorization to write the session-related triples


#### DELETE `/impersonate`

Remove any impersonation data and reset the session to its original state.

#### Response
##### 204 No Content
- If the impersonation data was succesfully deleted

##### 403 Forbidden
- If the user does not have the necessaryu authorization to write the session-related triples
