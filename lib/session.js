import { query, update, sparqlEscapeUri, sparqlEscapeString } from 'mu';

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

  // The query has been split in pieces, because mu-auth is a bit restrictive
  // If you need to write data to a graph you're permitted to write, but with data
  // from a graph you're only required to read.
  const insertOriginalAccountQuery = `
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
  `;
  await update(insertOriginalAccountQuery);

  const getDataToImpersonateQuery = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    SELECT DISTINCT
      ?impersonatedAccount
      ?impersonatedSessionGroup
      ?impersonatedSessionRole

     WHERE {

      VALUES ?impersonatedAccount {
        ${sparqlEscapeUri(accountUri)}
      }

      ?impersonatedAccount muExt:sessionRole ?impersonatedSessionRole .

       ?impersonatedUser foaf:account ?impersonatedAccount;
         foaf:member ?impersonatedSessionGroup .
      }
  `;

  const results = parseResult(await query(getDataToImpersonateQuery));

  const removeOldSessionQuery = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    DELETE {
      ?sessionUri muSession:account ?currentAccount ;
        muExt:sessionGroup ?currentSessionGroup ;
        muExt:sessionRole ?currentSessionRole .
    }
    WHERE {
      VALUES ?sessionUri {
        ${sparqlEscapeUri(sessionUri)}
      }
      ?sessionUri muSession:account ?currentAccount ;
        muExt:sessionGroup ?currentSessionGroup ;
        muExt:sessionRole ?currentSessionRole .
    }`;

  await update(removeOldSessionQuery);

  for(const result of results) {
    const insertNewSessionQuery = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
      PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

      INSERT DATA {
        ${sparqlEscapeUri(sessionUri)} muSession:account ${sparqlEscapeUri(result['impersonatedAccount'])} ;
          muExt:sessionGroup ${sparqlEscapeUri(result['impersonatedSessionGroup'])} ;
          muExt:sessionRole ${sparqlEscapeString(result['impersonatedSessionRole'])} .
      }
    `;
    await update(insertNewSessionQuery);
  }

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

/**
 * convert results of select query to an array of objects.
 * courtesy: Niels Vandekeybus & Felix
 * @method parseResult
 * @return {Array}
 */
function parseResult(result) {
  if (!(result.results && result.results.bindings.length)) return [];

  const bindingKeys = result.head.vars;
  return result.results.bindings.map((row) => {
    const obj = {};
    bindingKeys.forEach((key) => {
      if (row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#integer' && row[key].value) {
        obj[key] = parseInt(row[key].value);
      }
      else if (row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#dateTime' && row[key].value) {
        obj[key] = new Date(row[key].value);
      }
      else obj[key] = row[key] ? row[key].value : undefined;
    });
    return obj;
  });
};
