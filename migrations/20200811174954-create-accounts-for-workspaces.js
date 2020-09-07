const https = require('https');
const axios = require('axios');
const fs = require('fs');

require('dotenv').config({
  path: '../.env',
});

/**
 * Mutation for creating account
 */
const MUTATION_CREATE_ACCOUNT = `
  mutation AccountCreateMutation($input: AccountInput!) {
    account {
      create(input: $input) {
        recordId
      }
    }
  }
`;

/**
 * @file Create accounts for workspaces
 */
module.exports = {
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    const accountingApiConfig = {
      baseURL: process.env.CODEX_ACCOUNTING_URL,
      tlsVerify: process.env.TLS_VERIFY === 'true',
      tlsCaCertPath: process.env.TLS_CA_CERT,
      tlsCertPath: process.env.TLS_CERT,
      tlsKeyPath: process.env.TLS_KEY,
    };

    let httpsAgent = null;

    if (accountingApiConfig.tlsVerify) {
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(accountingApiConfig.tlsCaCertPath || ''),
        cert: fs.readFileSync(accountingApiConfig.tlsCertPath || ''),
        key: fs.readFileSync(accountingApiConfig.tlsKeyPath || ''),
      });
    }

    const apiInstance = axios.create({
      baseURL: accountingApiConfig.baseURL,
      timeout: 1000,
      httpsAgent: httpsAgent,
    });

    console.log('Start to creating accounts for workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Get all workspaces
         */
        const workspaces = await db.collection('workspaces').find()
          .toArray();

        /**
         * Each workspace should have a plan
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Skip workspaces, which already have plan
           */
          if (workspace.accountId) {
            return Promise.resolve();
          }
          console.log(`Workspace ${workspaceId} has no accountId`);

          console.log(accountingApiConfig.baseURL);

          const response = await apiInstance.post(accountingApiConfig.baseURL, {
            query: MUTATION_CREATE_ACCOUNT,
            variables: {
              input: {
                name: `WORKSPACE:${workspace.name}`,
                type: 'Liability',
                currency: 'USD',
              },
            },
          })
            .then(resp => {
              return resp.data;
            })
            .catch(resp => {
              console.error(resp);

              return Promise.reject(resp);
            });

          const recordId = response.data.account.create.recordId;

          /**
           * Save accountId
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $set: {
                accountId: recordId,
              },
            }
          );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} has an account ${recordId}`);
          } else {
            console.log(`Workspace ${workspaceId} failed updating`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }

    return true;
  },

  async down(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to rollback accountId adding...');

    try {
      await session.withTransaction(async () => {
        /**
         * Find workspaces with a plan
         */
        const workspaces = await db.collection('workspaces').find({
          accountId: {
            $exists: true,
          },
        })
          .toArray();

        /**
         * Remove accountIds from workspaces
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Remove accountId
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $unset: { accountId: '' },
            }
          );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} now has no accountId`);
          } else {
            console.log(`Workspace ${workspaceId} failed to remove an accountId`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }
  },
};
