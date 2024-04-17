import { app, errorHandler } from 'mu';
import {
  getImpersonatedSession,
  setImpersonatedSession,
  deleteImpersonatedSession,
} from './lib/session';
import { getResource } from './lib/resource';

app.get('/', function (_req, res) {
  res.send({ message: '👋 Hi, this is the impersonation-service 🕵' });
});

app.get('/impersonations/current', async function (req, res, next) {
  const muSessionId = req.get('mu-session-id');

  const {
    id: sessionId,
    impersonatedResourceId,
    originalResourceId,
  } = await getImpersonatedSession(muSessionId);

  if (!impersonatedResourceId) {
    return next({ message: 'No active impersonation' });
  }

  const data = {
    type: 'impersonations',
    id: sessionId,
    relationships: {
      impersonates: {
        links: `/resources/${impersonatedResourceId}`,
        data: { type: 'resources', id: impersonatedResourceId },
      },
      'original-resource': {
        data: { type: 'resources', id: originalResourceId }
      }
    }
  };

  res.send({
    links: {
      self: '/impersonations/current',
    },
    data,
  });
});

app.post('/impersonations', async function (req, res, next) {
  let resourceId;
  try {
    ({
      data: {
        relationships: {
          'impersonates': {
            data: {
              id: resourceId
            }
          }
        }
      }
    } = req.body);
    if (!resourceId) {
      return next({ message: `You need to pass a resource ID in the request body` });
    }
  } catch (e) {
    return next({ message: `Failed to parse the request body` });
  }

  const muSessionId = req.get('mu-session-id');

  try {
    const { uri: resource } = await getResource(resourceId);
    if (resource) {
      await setImpersonatedSession(muSessionId, resource);
    } else {
      return next({ message: `Could not find a resource with id ${resourceId}`, status: 404 });
    }
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not write data to impersonate resource  with id: <${resourceId}>`);
      return next({ message: `You don't have the necessary rights to impersonate other roles`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to impersonate resource  with id: <${resourceId}>`);
      console.error(e);
      return next({ message: 'Something went wrong' });
    }
  }

  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .status(204)
    .send();
});

app.delete('/impersonations/current', async function (req, res) {
  const muSessionId = req.get('mu-session-id');
  try {
    await deleteImpersonatedSession(muSessionId);
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not remove impersonation data`);
      return next({ message: `You don't have the necessary rights to stop impersonating other accounts`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to stop impersonating another account`);
      return next({ message: 'Something went wrong' });
    }
  }
  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .status(204)
    .send();
});

app.use(errorHandler);
