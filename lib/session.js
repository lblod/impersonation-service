import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
  SELECT
    DISTINCT ?uri ?id ?impersonatedResource ?impersonatedResourceId
  WHERE {
    BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
    ?uri mu:uuid ?id ;
         muAccount:impersonates ?impersonatedResource .
    ?impersonatedResource mu:uuid ?impersonatedResourceId .
  }`);
  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    return {
      uri: binding.uri.value,
      id: binding.id.value,
      impersonatedResource: binding.impersonatedResource.value,
      impersonatedResourceId: binding.impersonatedResourceId.value,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, resource) {
  return await update(`
  PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} muAccount:impersonates ?resource .
  }
  INSERT {
    ${sparqlEscapeUri(sessionUri)} muAccount:impersonates ${sparqlEscapeUri(resource)} .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} muAccount:impersonates ?resource .
  }`);
}

export async function deleteImpersonatedSession(sessionUri) {
  return await update(`
  PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
  DELETE WHERE {
    ${sparqlEscapeUri(sessionUri)} muAccount:impersonates ?resource .
  }`);
}
