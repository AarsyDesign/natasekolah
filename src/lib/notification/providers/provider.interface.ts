export interface SendMessageResult {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  deepLinkUrl?: string;
}

export interface IWhatsAppProvider {
  readonly id: string;
  readonly name: string;

  sendMessage(recipient: string, message: string): Promise<SendMessageResult>;
}
