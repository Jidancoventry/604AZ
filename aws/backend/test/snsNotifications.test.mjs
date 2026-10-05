import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCognitoEmailNotification,
  isCognitoEmailNotificationEvent
} from '../src/snsNotifications.mjs';

function cognitoEvent(triggerSource, email = 'member@example.com') {
  return {
    triggerSource,
    userPoolId: 'us-east-1_TestPool',
    userName: email,
    request: { userAttributes: { email } },
    response: {}
  };
}

test('recognises only the two supported Cognito email triggers', () => {
  assert.equal(isCognitoEmailNotificationEvent(cognitoEvent('PostConfirmation_ConfirmSignUp')), true);
  assert.equal(isCognitoEmailNotificationEvent(cognitoEvent('PostAuthentication_Authentication')), true);
  assert.equal(isCognitoEmailNotificationEvent(cognitoEvent('PreSignUp_SignUp')), false);
});

test('post confirmation creates one filtered email subscription', async () => {
  const calls = [];
  const client = {
    async send(command) {
      calls.push(command);
      if (command.constructor.name === 'ListSubscriptionsByTopicCommand') return { Subscriptions: [] };
      return { SubscriptionArn: 'pending confirmation' };
    }
  };
  const event = cognitoEvent('PostConfirmation_ConfirmSignUp', 'MEMBER@example.com');
  const result = await handleCognitoEmailNotification(event, {
    client,
    topicArn: 'arn:aws:sns:us-east-1:123456789012:e-swap-user-login-alerts'
  });
  assert.equal(result, event);
  assert.equal(calls.length, 2);
  const subscribe = calls.find((command) => command.constructor.name === 'SubscribeCommand');
  assert.equal(subscribe.input.Protocol, 'email');
  assert.equal(subscribe.input.Endpoint, 'member@example.com');
  assert.deepEqual(JSON.parse(subscribe.input.Attributes.FilterPolicy), {
    recipientEmail: ['member@example.com']
  });
});

test('post authentication publishes the filtered sign-in email', async () => {
  const calls = [];
  const client = { async send(command) { calls.push(command); return { MessageId: 'message-1' }; } };
  const event = cognitoEvent('PostAuthentication_Authentication');
  const result = await handleCognitoEmailNotification(event, {
    client,
    topicArn: 'arn:aws:sns:us-east-1:123456789012:e-swap-user-login-alerts'
  });
  assert.equal(result, event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, 'PublishCommand');
  assert.equal(calls[0].input.Subject, 'E-Swap security alert: new sign-in');
  assert.equal(calls[0].input.MessageAttributes.recipientEmail.StringValue, 'member@example.com');
});

test('SNS failures never block Cognito registration or sign-in', async () => {
  const client = { async send() { throw new Error('SNS unavailable'); } };
  const registration = cognitoEvent('PostConfirmation_ConfirmSignUp');
  const signIn = cognitoEvent('PostAuthentication_Authentication');
  assert.equal(await handleCognitoEmailNotification(registration, { client, topicArn: 'topic' }), registration);
  assert.equal(await handleCognitoEmailNotification(signIn, { client, topicArn: 'topic' }), signIn);
});
