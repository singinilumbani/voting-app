import type { AppConfig } from '../config/env.js';
import type { Logger } from '../core/logger.js';

export type HostEmailTemplateKey =
  | 'host.verify_email'
  | 'host.reset_password'
  | 'host.temporary_purge_warning'
  | 'host.inactivity_warning';

export interface EmailService {
  send(key: HostEmailTemplateKey, recipient: string, values: { link: string }): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor() {
    super('Host email delivery failed');
    this.name = 'EmailDeliveryError';
  }
}

interface EmailTemplate {
  subject: string;
  body: string;
}

const templates: Record<HostEmailTemplateKey, EmailTemplate> = {
  'host.verify_email': {
    subject: 'Verify your host account',
    body: 'Confirm your host account using this link: {{link}}'
  },
  'host.reset_password': {
    subject: 'Reset your host password',
    body: 'Reset your host account password using this link: {{link}}'
  },
  'host.temporary_purge_warning': {
    subject: 'Your temporary host account will be deleted soon',
    body: 'Your temporary host account and associated election data are scheduled for deletion in 48 hours. Review your account and export any reports you need: {{link}}'
  },
  'host.inactivity_warning': {
    subject: 'Your host account is inactive',
    body: 'Your host account has been inactive for five months. Log in within the next month to keep it active: {{link}}'
  }
};

export class ConsoleEmailService implements EmailService {
  constructor(private readonly logger: Logger) {}

  async send(
    key: HostEmailTemplateKey,
    recipient: string,
    values: { link: string }
  ): Promise<void> {
    void recipient;
    void values;
    this.logger.info({
      event: 'email.console',
      templateKey: key,
      subject: templates[key].subject,
      body: templates[key].body.replace('{{link}}', '[REDACTED]')
    });
  }
}

export class BrevoEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly sender: string,
    private readonly logger: Logger,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is required for Brevo email delivery');
    }
  }

  async send(
    key: HostEmailTemplateKey,
    recipient: string,
    values: { link: string }
  ): Promise<void> {
    const template = templates[key];
    let response: Response;
    try {
      response = await this.fetcher('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { email: this.sender },
          to: [{ email: recipient }],
          subject: template.subject,
          textContent: template.body.replace('{{link}}', values.link)
        })
      });
    } catch (error) {
      this.logger.error({
        event: 'email.brevo.delivery_failed',
        errorType: error instanceof Error ? error.name : 'unknown'
      });
      throw new EmailDeliveryError();
    }

    if (!response.ok) {
      this.logger.error({ event: 'email.brevo.delivery_failed', statusCode: response.status });
      throw new EmailDeliveryError();
    }
  }
}

export function createEmailService(config: AppConfig, logger: Logger): EmailService {
  if (config.emailProvider === 'brevo') {
    return new BrevoEmailService(config.brevoApiKey ?? '', config.emailFrom, logger);
  }
  return new ConsoleEmailService(logger);
}
