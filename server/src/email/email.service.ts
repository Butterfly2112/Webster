import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private host: string;
  private port: string;

  private readonly colors = {
    primary: '#274D69',
    secondary: '#6C8CAB',
    bg: '#f4f4f4',
    button: '#537dac',
    text: '#333333',
    muted: '#888888',
  };

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: this.configService.get('SMTP_SERVICE'),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });

    this.host = this.configService.get('HOST_FOR_EMAIL') || 'localhost';
    this.port = this.configService.get('PORT_FOR_EMAIL') || '5173';
  }

  private getHtmlTemplate(title: string, content: string): string {
    return `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: ${this.colors.bg}; padding: 40px 20px; margin: 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="background-color: ${this.colors.primary}; padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">Brawy</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px; color: ${this.colors.text}; font-size: 16px; line-height: 1.6;">
              <h2 style="color: ${this.colors.primary}; margin-top: 0; margin-bottom: 20px;">${title}</h2>
              ${content}
            </td>
          </tr>
         
          <tr>
            <td align="center" style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #eeeeee;">
              <p style="color: ${this.colors.muted}; font-size: 13px; margin: 0;">
                © ${new Date().getFullYear()} Brawy. All rights reserved.<br/>
                If you have any questions, contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private getButtonHtml(url: string, text: string): string {
    return `
      <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 25px; margin-bottom: 25px;">
        <tr>
          <td align="center" bgcolor="${this.colors.button}" style="border-radius: 8px;">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
              ${text}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  async sendEmailConfirmation(
    username: string,
    email: string,
    token: string,
  ): Promise<void> {
    const url = this.host.startsWith('http')
      ? `${this.host}/confirm-email?token=${token}`
      : `http://${this.host}:${this.port}/confirm-email?token=${token}`;

    const content = `
      <p>Hello <b>${username}</b>,</p>
      <p>Welcome to Brawy! We're thrilled to have you on board. To get started and unlock all features, please confirm your email address by clicking the button below.</p>
      ${this.getButtonHtml(url, 'Confirm Email')}
      <p style="color: ${this.colors.muted}; font-size: 14px; margin-top: 30px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${url}" style="color: ${this.colors.secondary}; word-break: break-all;">${url}</a>
      </p>
    `;

    const info = await this.transporter.sendMail({
      from: `"Brawy" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Welcome to Brawy! Please confirm your email',
      html: this.getHtmlTemplate('Confirm your registration', content),
    });

    console.log('Confirmation email sent: ', info.messageId);
  }

  async sendWelcomeMessageGoogle(
    username: string,
    email: string,
  ): Promise<void> {
    const content = `
      <p>Hello <b>${username}</b>,</p>
      <p>Welcome to Brawy! You have successfully registered using your Google account.</p>
      <p>Your workspace is ready. You can now start creating, editing, and managing your web projects easily.</p>
      ${this.getButtonHtml(`http://${this.host}:${this.port}/home`, 'Go to Dashboard')}
    `;

    const info = await this.transporter.sendMail({
      from: `"Brawy" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Welcome to Brawy!',
      html: this.getHtmlTemplate('Registration Successful', content),
    });

    console.log('Google welcome email sent: ', info.messageId);
  }

  async sendPasswordReset(
    username: string,
    email: string,
    token: string,
  ): Promise<void> {
    const url = this.host.startsWith('http')
      ? `${this.host}/reset-password?token=${token}`
      : `http://${this.host}:${this.port}/reset-password?token=${token}`;

    const content = `
      <p>Hello <b>${username}</b>,</p>
      <p>We received a request to reset the password for your Brawy account. You can securely set a new password by clicking the button below:</p>
      ${this.getButtonHtml(url, 'Reset Password')}
      <div style="background-color: #fff1f2; padding: 15px; border-radius: 8px; border-left: 4px solid #e11d48; margin-top: 30px;">
        <p style="margin: 0; color: #e11d48; font-size: 14px;">
          <strong>Didn't request this?</strong> If you didn't ask to reset your password, you can safely ignore this email. Your account is still secure.
        </p>
      </div>
    `;

    const info = await this.transporter.sendMail({
      from: `"Brawy" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Password Reset Request - Brawy',
      html: this.getHtmlTemplate('Reset your password', content),
    });

    console.log('Password reset email sent: ', info.messageId);
  }

  async sendEmailChangeRequest(
    username: string,
    newEmail: string,
    token: string,
  ): Promise<void> {
    const url = this.host.startsWith('http')
      ? `${this.host}/confirm-email-change?token=${token}`
      : `http://${this.host}:${this.port}/confirm-email-change?token=${token}`;

    const content = `
      <p>Hello <b>${username}</b>,</p>
      <p>We received a request to change your Brawy account email address to this one. To confirm the change, please click the button below:</p>
      ${this.getButtonHtml(url, 'Confirm Email Change')}
      <div style="background-color: #fff1f2; padding: 15px; border-radius: 8px; border-left: 4px solid #e11d48; margin-top: 30px;">
        <p style="margin: 0; color: #e11d48; font-size: 14px;">
          <strong>Didn't request this?</strong> If you didn't ask to change your email, someone might have mistyped theirs. You can safely ignore this email.
        </p>
      </div>
    `;

    const info = await this.transporter.sendMail({
      from: `"Brawy" <${this.configService.get('SMTP_USER')}>`,
      to: newEmail,
      subject: 'Confirm your new email address - Brawy',
      html: this.getHtmlTemplate('Email Change Request', content),
    });

    console.log('Email change request sent: ', info.messageId);
  }
}
