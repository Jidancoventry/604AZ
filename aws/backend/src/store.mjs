import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});

const STATE_KEY = 'ESWAP#STATE';

export class StateConflictError extends Error {
  constructor() {
    super('The E-Swap state changed while this request was being processed.');
    this.name = 'StateConflictError';
  }
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function loadState(tableName) {
  const response = await client.send(new GetCommand({
    TableName: tableName,
    Key: { PK: STATE_KEY },
    ConsistentRead: true
  }));
  if (!response.Item) return null;
  return {
    state: response.Item.state,
    version: Number(response.Item.version || 0)
  };
}

export async function createStateIfMissing(tableName, state) {
  try {
    await client.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: STATE_KEY,
        version: 1,
        state: clean(state),
        updatedAt: new Date().toISOString()
      },
      ConditionExpression: 'attribute_not_exists(PK)'
    }));
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') return false;
    throw error;
  }
}

export async function replaceState(tableName, state, expectedVersion) {
  try {
    await client.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: STATE_KEY,
        version: expectedVersion + 1,
        state: clean(state),
        updatedAt: new Date().toISOString()
      },
      ConditionExpression: '#version = :expectedVersion',
      ExpressionAttributeNames: { '#version': 'version' },
      ExpressionAttributeValues: { ':expectedVersion': expectedVersion }
    }));
    return expectedVersion + 1;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') throw new StateConflictError();
    throw error;
  }
}
