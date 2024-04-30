# Impersonation service
A microservice that allows users to impersonate other resources.

## Tutorials
### Add the impersonation-service to a stack
Add the following snippet to your `docker-compose.yml` file to include the impersonation service in your project.

```yml
impersonation:
  image: lblod/impersonation-service
```

Add rules to the `dispatcher.ex` to dispatch requests to the impersonation service.

```ex
match "/impersonations/*path", @json_service do
  forward conn, path, "http://impersonation/impersonations/"
end
```

To use this service (some of) the users will need write access to the `http://mu.semte.ch/graphs/sessions` graph.
You will also need to add a way to differentiate access for users by their role and by the role they are impersonating.

For example, you could have a regular way to determine access based on membership role. When impersonating a role,
you will automatically receive the data you'd expect to see if you were logged in as a user with the impersonated role.
But for some operations, like writing session data, you would want to use the role that's linked to the impersonating user.

A `mu-auth` config example close to `LBLOD` space (`app-digitaal-loket`):

```ex
# [...]
defp is_admin() do
  %AccessByQuery{
    vars: [],
    query: "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      SELECT DISTINCT ?session_role WHERE {
        VALUES ?session_role {
          \"LoketLB-admin\"
        }
        VALUES ?session_id {
          <SESSION_ID>
        }
        {
          ?session_id ext:sessionRole ?session_role .
        } UNION {
          ?session_id ext:originalSessionRole ?session_role .
        }
      }
      LIMIT 1"
    }
end

# [...]

def user_groups do
  [
    %GroupSpec{
      name: "sessions-admin",
      useage: [:read, :write, :read_for_write],
      access: is_admin(),
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

Each logged in user has a session stored in the triplestore. This service works on the assumption that the host app is using the [acmidm-login-service](https://github.com/lblod/acmidm-login-service) and/or [mock-login-service](https://github.com/lblod/mock-login-service) services. The session data will be stored as follows:

```nq
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/session/account> <http://example.com/account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/sessionGroup> <http://example.com/group-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/sessionRole> "RoleString" <http://mu.semte.ch/graphs/sessions> .

```

The service works by copying the original session data to new predicates and replacing them with the impersonated versions afterwards. This way the impersonation is transparent throughout the stack.
After impersonating a resource a user's session would look like this:

```nq
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/session/account> <http://example.com/impersonated-account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/sessionGroup> <http://example.com/impersonated-group-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/sessionRole> "RoleString" <http://mu.semte.ch/graphs/sessions> .

<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/originalResource> <http://example.com/account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/originalSessionGroup> <http://example.com/group-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/ext/originalSessionRole> "RoleString" <http://mu.semte.ch/graphs/sessions> .
```

### API
#### GET `/impersonations/current`

Fetch the impersonated role linked to the user of the current session.

#### Response
##### 200 OK

```json
{
  "data": {
    "type": "impersonations",
    "id": "impersonation-id",
    "attributes": {
      'original-session-roles': ['RoleString']
    },
    "relationships": {
      "impersonates": {
        "data": { "type": "resources", "id": "resource-id" }
      },
      "original-resource": {
        "data": { "type": "resources", "id": "resource-id" }
      },
      "original-session-group": {
        "data": { "type": "session-group", "id": "group-id" }
      },
    }
  },
  "links": {
    "self": "/impersonations/current"
  }
}
```

#### POST `/impersonations`

As the current session, impersonate the provided role.
#### Request body

```json
{
  "data": {
    "type": "impersonations",
    "relationships": {
      "impersonates": {
        "data": { "type": "resource", "id": "resource-id"}
      }
    }
  }
}
```

#### Response
##### 204 No Content
- If the impersonation data was successfully stored

##### 400 Bad Request
- If the account or membership are missing from the request body

##### 403 Forbidden
- If the user does not have the necessary authorization to write the session-related triples
  - Note: mu-auth should be configured to return 403. Else default behaviour of mu-auth remains.


#### DELETE `/impersonations/current`

Remove any impersonation data and reset the session to its original state.

#### Response
##### 204 No Content
- If the impersonation data was successfully deleted

##### 403 Forbidden
- If the user does not have the necessary authorization to write the session-related triples
  - Note: mu-auth should be configured to return 403. Else default behaviour of mu-auth remains.
