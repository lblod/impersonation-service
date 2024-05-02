import { query, update, sparqlEscapeUri } from 'mu';

export async function getImpersonatedSession(sessionUri) {
  const response = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/impersonation/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    SELECT DISTINCT 
      ?uri ?id ?impersonatedAccount ?impersonatedAccountId ?originalAccount ?originalAccountId ?originalSessionRoles ?originalSessionGroupId
    WHERE {
      BIND(${sparqlEscapeUri(sessionUri)} AS ?uri)
      ?uri mu:uuid ?id ;
        muSession:account ?impersonatedAccount ;
        muExt:originalAccount ?originalAccount ;
        muExt:originalSessionGroup ?originalSessionGroup ;
        muExt:originalSessionRole ?originalSessionRoles .

      ?impersonatedAccount mu:uuid ?impersonatedAccountId .
      ?originalAccount mu:uuid ?originalAccountId .
      ?originalSessionGroup mu:uuid ?originalSessionGroupId .
    }
  `);

  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    const originalSessionRoles = response.results.bindings.map(binding => binding.originalSessionRoles.value);

    return {
      uri: binding.uri.value,
      id: binding.id.value,
      impersonatedAccount: binding.impersonatedAccount.value,
      impersonatedAccountId: binding.impersonatedAccountId.value,
      originalAccount: binding.originalAccount.value,
      originalAccountId: binding.originalAccountId.value,
      originalSessionGroupId: binding.originalSessionGroupId.value,
      originalSessionRoles,
    };
  }
  return {};
}

export async function setImpersonatedSession(sessionUri, accountUri) {
  return await update(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    INSERT {
      ?sessionUri
        muExt:originalAccount ?originalAccount ;
        muExt:originalSessionGroup ?originalSessionGroup ;
        muExt:originalSessionRole ?originalSessionRole .
    }
    WHERE {
      VALUES ?sessionUri {
        ${sparqlEscapeUri(sessionUri)}
      }

      ?sessionUri muSession:account ?originalAccount ;
        muExt:sessionGroup ?originalSessionGroup ;
        muExt:sessionRole ?originalSessionRole .

      FILTER NOT EXISTS {
        ?sessionUri
          muExt:originalAccount ?maybeoriginalAccount ;
          muExt:originalSessionGroup ?maybeOriginalSessionGroup ;
          muExt:originalSessionRole ?maybeOriginalSessionRole .
      }
    }

    ;

    DELETE {
      ?sessionUri muSession:account ?currentAccount ;
        muExt:sessionGroup ?currentSessionGroup ;
        muExt:sessionRole ?currentSessionRole .
    }
    INSERT {
      ?sessionUri muSession:account ?impersonatedAccount ;
        muExt:sessionGroup ?impersonatedSessionGroup ;
        muExt:sessionRole ?impersonatedSessionRole .
    }
    WHERE {
      VALUES ?sessionUri {
        ${sparqlEscapeUri(sessionUri)}
      }

      VALUES ?impersonatedAccount {
        ${sparqlEscapeUri(accountUri)}
      }

      ?sessionUri muSession:account ?currentAccount ;
        muExt:sessionGroup ?currentSessionGroup ;
        muExt:sessionRole ?currentSessionRole .

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
        muExt:originalAccount ?originalAccount ;
        muExt:originalSessionRole ?originalSessionRole ;
        muExt:originalSessionGroup ?originalSessionGroup .
    } 
    INSERT {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?originalAccount ;
        muExt:sessionGroup ?originalSessionGroup ;
        muExt:sessionRole ?originalSessionRole .
    }
    WHERE {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?impersonatedAccount ;
        muExt:sessionGroup ?impersonatedSessionGroup ;
        muExt:sessionRole ?impersonatedSessionRole ;
        muExt:originalAccount ?originalAccount ;
        muExt:originalSessionRole ?originalSessionRole ;
        muExt:originalSessionGroup ?originalSessionGroup .
    }`
  );
}
