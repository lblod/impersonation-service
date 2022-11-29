import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  SELECT
    ?uri ?id ?role ?roleId
  WHERE {
    BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
    ?uri mu:uuid ?id ;
         ext:impersonatedRole ?role .
    ?role mu:uuid ?roleId .
  }`);
  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    return {
      uri: binding.uri.value,
      id: binding.id.value,
      role: binding.role.value,
      roleId: binding.roleId.value,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, role) {
  return await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatedRole ?role .
  }
  INSERT {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatedRole ${sparqlEscapeUri(role)} .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatedRole ?role .
  }`);
}

export async function deleteImpersonatedSession(sessionUri) {
  return await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE WHERE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatedRole ?role .
  }`);
}
