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
match "/impersonations/*path*", @json_service do
  Proxy.forward conn, path, "http://impersonation/impersonations/"
end
```

To use this service (some of) the users will need write access to the `http://mu.semte.ch/graphs/sessions` graph.
You will also need to add a way to differentiate access for users by their role and by the role they are impersonating.

For example, you could have a regular way to determine access based on membership role. When impersonating a role,
you will automatically receive the data you'd expect to see if you were logged in as a user with the impersonated role.
But for some operations, like writing session data, you would want to use the role that's linked to the impersonating user.

```ex
defp access_by_role(role_uris) do
  %AccessByQuery{
    vars: [],
    query: "PREFIX org: <http://www.w3.org/ns/org#>
            PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
            SELECT ?role_uri WHERE {
              <SESSION_ID> ext:sessionMembership / org:role ?ownRole .
              OPTIONAL { <SESSION_ID> muAccount:impersonates ?maybeImpersonatedRole }
              BIND(COALESCE(?maybeImpersonatedRole, ?ownRole) AS ?role_uri)
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
              <SESSION_ID> ext:sessionMembership / org:role ?role_uri .
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

As an `mu-auth` config example closer to `LBLOD` space (`app-digitaal-loket`):

```
# [...]

  defp access_by_role( group_string ) do
    %AccessByQuery{
      vars: ["session_group","session_role"],
      query: sparql_query_for_access_role( group_string ) }
  end

  defp access_by_role_for_single_graph( group_string ) do
    %AccessByQuery{
      vars: [],
      query: sparql_query_for_access_role( group_string ) }
  end

# [...]

  defp sparql_query_for_access_role( group_string ) do
    "
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>

      SELECT DISTINCT ?session_group ?session_role WHERE {

        VALUES ?session_role {
           \"#{group_string}\"
        }

       {
          <SESSION_ID> ext:sessionGroup/mu:uuid ?own_group;
                        ext:sessionRole ?session_role.
       } UNION {

         <SESSION_ID> muAccount:impersonates ?maybe_impersonated.

         ?maybe_impersonated a foaf:OnlineAccount;
           ext:sessionRole ?session_role;
           foaf:accountServiceHomepage <https://github.com/lblod/mock-login-service>.

         ?person a foaf:Person;
           foaf:account ?maybe_impersonated;
           foaf:member ?maybe_impersonated_group.
       }
       BIND(COALESCE(?maybe_impersonated_group, ?own_group) AS ?session_group)
    }
    LIMIT 1"
  end

# [...]

def user_groups do
  [
    %GroupSpec{
      name: "sessions-admin",
      useage: [:read, :write, :read_for_write],
      access: access_by_role_for_single_graph("LoketAdmin"),
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
```

The service works by adding a new triple with the `http://mu.semte.ch/vocabularies/account/impersonation/impersonates` predicate to tell the system which resource a user is impersonating.
After impersonating a resource a user's session would look like this:

```nq
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/session/account> <http://example.com/account-id> <http://mu.semte.ch/graphs/sessions> .
<http://mu.semte.ch/sessions/session-id> <http://mu.semte.ch/vocabularies/account/impersonation/impersonates> <http://example.com/resource-id> <http://mu.semte.ch/graphs/sessions> .
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
    "relationships": {
      "impersonates": {
        "links": "/resources/resource-id",
        "data": { "type": "resources", "id": "resource-id" }
      }
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
