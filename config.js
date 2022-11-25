export const ADMIN_ROLE_URI = process.env.ADMIN_ROLE_URI || 'http://themis.vlaanderen.be/id/gebruikersrol/9a969b13-e80b-424f-8a82-a402bcb42bc5';

export const MU_AUTH_ALLOWED_GROUPS = {
  'admin': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "admin" },
    { "variables": [], "name": "secretarie" },
    { "variables": [], "name": "ovrb" },
    { "variables": [], "name": "clean" },
  ],
  'secretarie': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "secretarie" },
    { "variables": [], "name": "clean" },
  ],
  'ovrb': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "ovrb" },
    { "variables": [], "name": "clean" },
  ],
  'minister': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "o-minister-read" },
    { "variables": [], "name": "clean" },
  ],
  'kabinet': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "o-intern-regering-read" },
    { "variables": [], "name": "clean" },
  ],
  'overheid': [
    { "variables": [], "name": "public" },
    { "variables": [], "name": "authenticated" },
    { "variables": [], "name": "o-intern-overheid-read" },
    { "variables": [], "name": "clean" },
  ],
}
