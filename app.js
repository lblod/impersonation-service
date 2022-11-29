import { app, errorHandler } from 'mu';
import {
  getImpersonatedSession,
  setImpersonatedSession,
  deleteImpersonatedSession,
} from './lib/session';

app.get('/', function(_req, res) {
  res.send({ message: '👋 Hi, this is the impersonation-service 🕵' });
});

app.get('/who-am-i', async function(req, res) {
  const muSessionId = req.get('mu-session-id');

  const {
    id: sessionId,
    roleId,
  } = await getImpersonatedSession(muSessionId);

  const data = {
    type: 'sessions',
    id: sessionId,
  }

  if (roleId) {
    data.relationships ??= {};
    data.relationships.role = {
      links: `/roles/${roleId}`,
      data: { type: 'roles', id: roleId },
    }
  }

  res.send({
    links: {
      self: '/who-am-i',
    },
    data,
  });
});

app.post('/impersonate', async function(req, res, next) {
  let role;
  try {
    ({
      data: {
        relationships: {
          role: {
            data: {
              attributes: {
                uri: role,
              }
            }
          }
        }
      }
    } = req.body);
    if (!role) {
      return next({ message: `You need to pass a role in the request body` });
    }
  } catch (e) {
    return next({ message: `Failed to parse the request body` });
  }

  const muSessionId = req.get('mu-session-id');

  try {
    await setImpersonatedSession(muSessionId, role);
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not write data to impersonate role <${role}>`)
      next({ message: `You don't have the necessary rights to impersonate other accounts`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to impersonate role <${role}>`)
      console.error(e);
      next({ message: 'Something went wrong' });
    }
    return;
  }

  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .status(204)
    .send();
});

app.delete('/impersonate', async function(req, res) {
  const muSessionId = req.get('mu-session-id');
  try {
    await deleteImpersonatedSession(muSessionId);
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not remove impersonation data`)
      return next({ message: `You don't have the necessary rights to stop impersonating other accounts`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to stop impersonating another account`)
      return next({ message: 'Something went wrong' });
    }
  }
  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .status(204)
    .send();
});

app.use(errorHandler);
