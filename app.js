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
    impersonatorAccountId,
    impersonatorMembershipId,
  } = await getImpersonatedSession(muSessionId);

  const data = {
    type: 'sessions',
    id: sessionId,
  }

  if (impersonatorAccountId) {
    data.relationships ??= {};
    data.relationships.account = {
      links: `/accounts/${impersonatorAccountId}`,
      data: { type: 'accounts', id: impersonatorAccountId },
    }
  }

  if (impersonatorMembershipId) {
    data.relationships ??= {};
    data.relationships.membership = {
      links: `/memberships/${impersonatorMembershipId}`,
      data: { type: 'memberships', id: impersonatorMembershipId },
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
  const {
    data: {
      relationships: {
        account: {
          data: {
            attributes: {
              uri: impersonatedAccount,
            }
          }
        },
        membership: {
          data: {
            attributes: {
              uri: impersonatedMembership,
            }
          }
        }
      }
    }
  } = req.body;
  if (!impersonatedAccount && !impersonatedMembership) {
    next({ message: `You need to pass both an account and a membership in the request body` });
    return;
  }

  const muSessionId = req.get('mu-session-id');

  const {
    id: sessionId,
    impersonatorAccount,
    impersonatorAccountId,
    impersonatorMembership,
    impersonatorMembershipId,
  } = await getImpersonatedSession(muSessionId);

  try {
    await setImpersonatedSession(
      muSessionId,
      impersonatorAccount,
      impersonatorMembership,
      impersonatedAccount,
      impersonatedMembership,
    );
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not write data to impersonate account <${impersonatedAccount}> with membership <${impersonatedMembership}>`)
      next({ message: `You don't have the necessary rights to impersonate other accounts`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to impersonate account <${impersonatedAccount}> with membership <${impersonatedMembership}>`)
      next({ message: 'Something went wrong' });
    }
    return;
  }

  const data = {
    type: 'sessions',
    id: sessionId,
  }

  if (impersonatorAccountId) {
    data.relationships ??= {};
    data.relationships.account = {
      links: `/accounts/${impersonatorAccountId}`,
      data: { type: 'accounts', id: impersonatorAccountId },
    }
  }

  if (impersonatorMembershipId) {
    data.relationships ??= {};
    data.relationships.membership = {
      links: `/memberships/${impersonatorMembershipId}`,
      data: { type: 'memberships', id: impersonatorMembershipId },
    }
  }

  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .send({
      links: {
        self: '/who-am-i',
      },
      data,
    });
});

app.delete('/impersonate', async function(req, res) {
  const muSessionId = req.get('mu-session-id');
  try {
    await deleteImpersonatedSession(muSessionId);
  } catch (e) {
    if (e.httpStatus === 403) {
      console.warn(`Session <${muSessionId}> could not remove impersonation data`)
      next({ message: `You don't have the necessary rights to stop impersonating other accounts`, status: 403 });
    } else {
      console.warn(`Something went wrong while session <${muSessionId}> tried to stop impersonating another account`)
      next({ message: 'Something went wrong' });
    }
    return;
  }
  res.header('mu-auth-allowed-groups', 'CLEAR').status(204).send();
});

app.use(errorHandler);
