import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  SELECT
    ?uri ?id
    ?impersonatedAccount ?impersonatedAccountId
    ?impersonatedMembership ?impersonatedMembershipId
  WHERE {
    BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
    ?uri mu:uuid ?id ;
         ext:impersonatesMembership ?impersonatedMembership ;
         ext:impersonates ?impersonatedAccount .
    ?impersonatedAccount mu:uuid ?impersonatedAccountId .
    ?impersonatedMembership mu:uuid ?impersonatedMembershipId .
  }`);
  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    return {
      uri: binding.uri.value,
      id: binding.id.value,
      impersonatedAccount: binding.impersonatedAccount?.value,
      impersonatedAccountId: binding.impersonatedAccountId?.value,
      impersonatedMembership: binding.impersonatedMembership?.value,
      impersonatedMembershipId: binding.impersonatedMembershipId?.value,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, impersonatedAccount, impersonatedMembership) {
  return await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatesMembership ?membership ;
      ext:impersonates ?account .
  }
  INSERT {
    ${sparqlEscapeUri(sessionUri)} ext:impersonates ${sparqlEscapeUri(impersonatedAccount)} ;
      ext:impersonatesMembership ${sparqlEscapeUri(impersonatedMembership)} .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatesMembership ?membership ;
      ext:impersonates ?account .
  }`);
}

export async function deleteImpersonatedSession(sessionUri) {
  return await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatesMembership ?membership ;
      ext:impersonates ?account .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} ext:impersonatesMembership ?membership ;
      ext:impersonates ?account .
  }`);
}
