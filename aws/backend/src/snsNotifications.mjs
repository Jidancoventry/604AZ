import {
  ListSubscriptionsByTopicCommand,
  PublishCommand,
  SNSClient,
  SubscribeCommand
} from '@aws-sdk/client-sns';

const sns = new SNSClient({});

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function eventEmail(event) {
  return normaliseEmail(event?.request?.userAttributes?.email || event?.userName);
}

async function subscriptionExists(client, topicArn, email) {
  let nextToken;
  do {
    const page = await client.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn,
      NextToken: nextToken
    }));
    if ((page.Subscriptions || []).some((subscription) => (
      subscription.Protocol === 'email'
      && normaliseEmail(subscription.Endpoint) === email
    ))) return true;
    nextToken = page.NextToken;
  } while (nextToken);
  return false;
}

async function subscribeLoginEmail(client, topicArn, email) {
  if (await subscriptionExists(client, topicArn, email)) {
    console.info('E-Swap login alert subscription already exists', { email });
    return;
  }

  await client.send(new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: 'email',
    Endpoint: email,
    ReturnSubscriptionArn: true,
    Attributes: {
      FilterPolicy: JSON.stringify({ recipientEmail: [email] })
    }
  }));
  console.info('E-Swap login alert subscription requested', { email });
}

async function publishLoginAlert(client, topicArn, email, event) {
  const signedInAt = new Date().toISOString();
  const userPoolId = String(event?.userPoolId || 'unknown');
  const region = userPoolId.includes('_') ? userPoolId.split('_')[0] : process.env.AWS_REGION || 'us-east-1';
  const message = [
    'A new sign-in to your E-Swap 2.2 account was detected.',
    '',
    `Account: ${email}`,
    `Time: ${signedInAt}`,
    `AWS Region: ${region}`,
    '',
    'If this was you, no action is required.',
    'If this was not you, reset your E-Swap password immediately and contact the platform administrator.',
    '',
    'E-Swap 2.2 security notification'
  ].join('\n');

  await client.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: 'E-Swap security alert: new sign-in',
    Message: message,
    MessageAttributes: {
      recipientEmail: {
        DataType: 'String',
        StringValue: email
      }
    }
  }));
  console.info('E-Swap login alert published', { email });
}

export function isCognitoEmailNotificationEvent(event) {
  return event?.triggerSource === 'PostConfirmation_ConfirmSignUp'
    || event?.triggerSource === 'PostAuthentication_Authentication';
}

export async function handleCognitoEmailNotification(event, {
  client = sns,
  topicArn = process.env.LOGIN_ALERT_TOPIC_ARN
} = {}) {
  if (!isCognitoEmailNotificationEvent(event)) return event;

  const email = eventEmail(event);
  if (!topicArn || !email) {
    console.warn('E-Swap login alert skipped', {
      reason: !topicArn ? 'LOGIN_ALERT_TOPIC_ARN is not configured' : 'Cognito email is missing'
    });
    return event;
  }

  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    try {
      await subscribeLoginEmail(client, topicArn, email);
    } catch (error) {
      console.warn('E-Swap login alert subscription failed', {
        email,
        name: error?.name,
        message: error?.message
      });
    }
    return event;
  }

  try {
    await publishLoginAlert(client, topicArn, email, event);
  } catch (error) {
    console.warn('E-Swap login alert publish failed', {
      email,
      name: error?.name,
      message: error?.message
    });
  }
  return event;
}
