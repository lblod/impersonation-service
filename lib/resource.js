import { query, sparqlEscapeString } from 'mu';

export async function getResource(resourceId) {
  const response = await query(`
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX org: <http://www.w3.org/ns/org#>
  SELECT DISTINCT ?uri
  WHERE {
    ?uri mu:uuid ${sparqlEscapeString(resourceId)} .
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
