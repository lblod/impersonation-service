import { app, errorHandler } from 'mu';
import {
  getImpersonatedSession,
  setImpersonatedSession,
  deleteImpersonatedSession,
} from './lib/session';

app.get('/', function(_req, res) {
  res.send({ message: '👋 Hi, this is the impersonation-service 🕵' });
});

app.get('/impersonate/current', async function(req, res) {
  const muSessionId = req.get('mu-session-id');

  const {
    id: sessionId,
    impersonatedAccountId,
    impersonatedMembershipId,
  } = await getImpersonatedSession(muSessionId);

  const data = {
    type: 'sessions',
    id: sessionId,
  }

  if (impersonatedAccountId) {
    data.relationships ??= {};
    data.relationships.account = {
      links: `/accounts/${impersonatedAccountId}`,
      data: { type: 'accounts', id: impersonatedAccountId },
    }
  }

  if (impersonatedMembershipId) {
    data.relationships ??= {};
    data.relationships.memebrship = {
      links: `/memberships/${impersonatedMembershipId}`,
      data: { type: 'memberships', id: impersonatedMembershipId },
    }
  }

  res.send({
    links: {
      self: '/impersonate/current',
    },
    data,
  });
});

app.post('/impersonate/current', async function(req, res) {
  const { impersonatedAccount, impersonatedMembership } = req.body;
  if (!impersonatedAccount && !impersonatedMembership) {
    // Respond with an error
    res.status(400).send();
    return;
  }

  const muSessionId = req.get('mu-session-id');
  await setImpersonatedSession(
    muSessionId,
    impersonatedAccount,
    impersonatedMembership,
  );

  const {
    id: sessionId,
    impersonatedAccountId,
    impersonatedMembershipId,
  } = await getImpersonatedSession(muSessionId);

  res
    .header('mu-auth-allowed-groups', 'CLEAR')
    .status(204)
    .send({
      links: {
        self: '/impersonate/current',
      },
      data: {
        type: 'sessions',
        id: sessionId,
        relationships: {
          ...(impersonatedAccountId ?
            {
              account: {
                links: `/accounts/${impersonatedAccountId}`,
                data: { type: 'accounts', id: impersonatedAccountId },
              }
            } : {}),
          ...(impersonatedMembershipId ? {
            membership: {
              links: `/memberships/${impersonatedMembershipId}`,
              data: { type: 'memberships', id: impersonatedMembershipId },
            }
          } : {}),
        },
      }
    });
});

app.delete('/impersonate', async function(req, res) {
  const muSessionId = req.get('mu-session-id');
  await deleteImpersonatedSession(muSessionId);
  res.header('mu-auth-allowed-groups', 'CLEAR').status(204).send();
});

app.use(errorHandler);
