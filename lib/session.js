import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    SELECT DISTINCT 
      ?uri ?id ?impersonatedResource ?impersonatedResourceId ?originalResource ?originalResourceId ?originalSessionRoles ?originalSessionGroupId
    WHERE {
      BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
      ?uri mu:uuid ?id ;
        muSession:account ?impersonatedResource ;
        muExt:originalResource ?originalResource ;
        muExt:originalSessionGroup ?originalSessionGroup ;
        muExt:originalSessionRole ?originalSessionRoles .

      ?impersonatedResource mu:uuid ?impersonatedResourceId .
      ?originalResource mu:uuid ?originalResourceId .
      ?originalSessionGroup mu:uuid ?originalSessionGroupId .
    }
  `);

  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    const originalSessionRoles = response.results.bindings.map(binding => binding.originalSessionRoles.value);

    return {
      uri: binding.uri.value,
      id: binding.id.value,
      impersonatedResource: binding.impersonatedResource.value,
      impersonatedResourceId: binding.impersonatedResourceId.value,
      originalResource: binding.originalResource.value,
      originalResourceId: binding.originalResourceId.value,
      originalSessionGroupId: binding.originalSessionGroupId.value,
      originalSessionRoles,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, resourceUri) {
  // TODO, this needs more work for the "choose a new impersonation" flow, it only works for the first impersonation
  // Not sure how to fix this. We could do a "are we impersonating check" and then execute different queries,
  // or do some sort of query that first checks the originalX predicates before copying

  return await update(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    DELETE {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?originalResource ;
        muExt:sessionGroup ?originalSessionGroup ;
        muExt:sessionRole ?originalSessionRole .
    } 
    INSERT {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?impersonatedAccount ;
        muExt:sessionGroup ?impersonatedSessionGroup ;
        muExt:sessionRole ?impersonatedSessionRole ;
        muExt:originalResource ?originalResource ;
        muExt:originalSessionGroup ?originalSessionGroup ;
        muExt:originalSessionRole ?originalSessionRole .
    }
    WHERE {
      BIND(${sparqlEscapeUri(resourceUri)} as ?impersonatedAccount)

      ${sparqlEscapeUri(sessionUri)} muSession:account ?originalResource ;
        muExt:sessionGroup ?originalSessionGroup ;
        muExt:sessionRole ?originalSessionRole .

      ?impersonatedAccount muExt:sessionRole ?impersonatedSessionRole .
      ?impersonatedUser foaf:account ?impersonatedAccount ;
        foaf:member ?impersonatedSessionGroup .
    }`
  );
}

export async function deleteImpersonatedSession(sessionUri) {
  return await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    DELETE {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?impersonatedAccount ;
        muExt:sessionGroup ?impersonatedSessionGroup ;
        muExt:sessionRole ?impersonatedSessionRole ;
        muExt:originalResource ?originalResource ;
        muExt:originalSessionRole ?originalSessionRole ;
        muExt:originalSessionGroup ?originalSessionGroup .
    } 
    INSERT {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?originalResource ;
        muExt:sessionGroup ?originalSessionGroup ;
        muExt:sessionRole ?originalSessionRole .
    }
    WHERE {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?impersonatedAccount ;
        muExt:sessionGroup ?impersonatedSessionGroup ;
        muExt:sessionRole ?impersonatedSessionRole ;
        muExt:originalResource ?originalResource ;
        muExt:originalSessionRole ?originalSessionRole ;
        muExt:originalSessionGroup ?originalSessionGroup .
    }`
  );
}
