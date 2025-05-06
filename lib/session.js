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

  // The query is split into pieces due to mu-auth restrictions.
  // You can write data to a graph you have write permissions for,
  // but mu-auth won't perform DELETE/INSERT operations if the data
  // originates from a read-only graph.
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

    CONSTRUCT {
      ${sparqlEscapeUri(sessionUri)} muSession:account ?impersonatedAccount ;
          muExt:sessionGroup ?impersonatedSessionGroup ;
          muExt:sessionRole ?impersonatedSessionRole .
    }
    WHERE {

      VALUES ?impersonatedAccount {
        ${sparqlEscapeUri(accountUri)}
      }

      ?impersonatedAccount muExt:sessionRole ?impersonatedSessionRole .

       ?impersonatedUser foaf:account ?impersonatedAccount;
         foaf:member ?impersonatedSessionGroup .
      }
  `;

  const results = (await query(getDataToImpersonateQuery))?.results?.bindings || [];
  const triples = toTermObjectArray(results)

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

  const insertNewSessionQuery = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muExt:  <http://mu.semte.ch/vocabularies/ext/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>

    INSERT DATA {
       ${triples.join(".\n")}
    }`;

  await update(insertNewSessionQuery);

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
 * Transform an array of triples to a string of statements to use in a SPARQL query
 *
 * @param {Array} triples Array of triples to convert
 * @method toTermObjectArray
 * @private
 */
export function toTermObjectArray(triples) {
  const escape = function (rdfTerm) {
    const { type, value, datatype } = rdfTerm;
    // Might not be ideal: two ways of anotating language
    //   xml:lang  conforms to https://www.w3.org/TR/sparql11-results-json/
    //   lang      conforms to https://www.w3.org/TR/rdf-json/
    // We look for both to capture all intentions.
    const lang = rdfTerm['xml:lang'] || rdfTerm?.lang;
    if (type === 'uri') {
      return sparqlEscapeUri(value);
    } else if (type === 'literal' || type === 'typed-literal') {
      if (datatype)
        return `${sparqlEscapeString(value.toString())}^^${sparqlEscapeUri(datatype)}`;
      else if (lang)
        return `${sparqlEscapeString(value)}@${lang}`;
      else
        return `${sparqlEscapeString(value)}`;
    } else
      console.log(`Don't know how to escape type ${type}. Will escape as a string.`);
    return sparqlEscapeString(value);
  };

  return triples.map(t => `${escape(t.s)} ${escape(t.p)} ${escape(t.o)}`);
}
