import { query, sparqlEscapeString } from 'mu';

export async function getRole(roleId) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX org: <http://www.w3.org/ns/org#>
  SELECT ?uri
  WHERE {
    ?uri a org:Role ; mu:uuid ${sparqlEscapeString(roleId)} .
  }
  LIMIT 1`);
  if (response.results.bindings.length) {
    const binding = response.results.bindings[0];
    return {
      uri: binding.uri.value,
    };
  }
  return {};
}
