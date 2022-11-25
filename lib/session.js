import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX session: <http://mu.semte.ch/vocabularies/session/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  SELECT
    ?uri ?id
    ?impersonatorAccount ?impersonatorAccountId
    ?impersonatorMembership ?impersonatorMembershipId
    ?impersonatedAccount ?impersonatedAccountId
    ?impersonatedMembership ?impersonatedMembershipId
  WHERE {
    BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
    ?uri mu:uuid ?id ;
         ext:sessionMembership ?maybeImpersonatedMembership ;
         session:account ?maybeImpersonatedAccount .
    OPTIONAL {
      ?uri ext:impersonator ?maybeImpersonatorAccount ;
           ext:impersonatorMembership ?maybeImpersonatorMembership .
    }
    BIND(COALESCE(?maybeImpersonatorAccount, ?maybeImpersonatedAccount) AS ?impersonatorAccount)
    BIND(COALESCE(?maybeImpersonatorMembership, ?maybeImpersonatedMembership) AS ?impersonatorMembership)
    ?impersonatorAccount mu:uuid ?impersonatorAccountId .
    ?impersonatorMembership mu:uuid ?impersonatorMembershipId .

    BIND(IF(BOUND(?maybeImpersonatorAccount), ?maybeImpersonatedAccount, <>) AS ?impersonatedAccount)
    BIND(IF(BOUND(?maybeImpersonatorMembership), ?maybeImpersonatedMembership, <>) AS ?impersonatedMembership)
    OPTIONAL { ?impersonatedAccount mu:uuid ?impersonatedAccountId }
    OPTIONAL { ?impersonatedMembership mu:uuid ?impersonatedMembershipId }
  }`);
  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    return {
      uri: binding.uri.value,
      id: binding.id.value,
      impersonatorAccount: binding.impersonatorAccount?.value,
      impersonatorAccountId: binding.impersonatorAccountId?.value,
      impersonatorMembership: binding.impersonatorMembership?.value,
      impersonatorMembershipId: binding.impersonatorMembershipId?.value,
      impersonatedAccount: binding.impersonatedAccount?.value,
      impersonatedAccountId: binding.impersonatedAccountId?.value,
      impersonatedMembership: binding.impersonatedMembership?.value,
      impersonatedMembershipId: binding.impersonatedMembershipId?.value,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, impersonatorAccount, impersonatorMembership, impersonatedAccount, impersonatedMembership) {
  return await update(`
  PREFIX session: <http://mu.semte.ch/vocabularies/session/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} session:account ?account ;
      ext:sessionMembership ?membership .
  }
  INSERT {
    ${sparqlEscapeUri(sessionUri)} session:account ${sparqlEscapeUri(impersonatedAccount)} ;
      ext:sessionMembership ${sparqlEscapeUri(impersonatedMembership)} ;
      ext:impersonator ${sparqlEscapeUri(impersonatorAccount)} ;
      ext:impersonatorMembership ${sparqlEscapeUri(impersonatorMembership)} .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} session:account ?account ;
      ext:sessionMembership ?membership .
  }`);
}

export async function deleteImpersonatedSession(sessionUri) {
  return await update(`
  PREFIX session: <http://mu.semte.ch/vocabularies/session/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    ${sparqlEscapeUri(sessionUri)} session:account ?impersonatedOrOwnAccount ;
      ext:sessionMembership ?impersonatedOrOwnMembership ;
      ext:impersonator ?ownAccount ;
      ext:impersonatorMembership ?ownMembership .
  }
  INSERT {
    ${sparqlEscapeUri(sessionUri)} session:account ?ownAccount ;
      ext:sessionMembership ?ownMembership .
  } WHERE {
    ${sparqlEscapeUri(sessionUri)} session:account ?impersonatedOrOwnAccount ;
      ext:sessionMembership ?impersonatedOrOwnMembership .
    OPTIONAL {
      ?uri ext:impersonator ?maybeOwnAccount ;
           ext:impersonatorMembership ?maybeOwnMembership .
    }
    BIND(COALESCE(?maybeOwnAccount, ?impersonatedOrOwnAccount) AS ?ownAccount)
    BIND(COALESCE(?maybeOwnMembership, ?impersonatedOrOwnMembership) AS ?ownMembership)
  }`);
}
