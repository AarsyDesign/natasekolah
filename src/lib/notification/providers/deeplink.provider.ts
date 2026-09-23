import { IWhatsAppProvider, SendMessageResult } from "./provider.interface";

export class DeepLinkWhatsAppProvider implements IWhatsAppProvider {
  readonly id = "deeplink";
  readonly name = "WhatsApp Direct DeepLink (Manual / Zero-Cost)";

  async sendMessage(recipient: string, message: string): Promise<SendMessageResult> {
    const encodedMessage = encodeURIComponent(message);
    const deepLinkUrl = `https://wa.me/${recipient}?text=${encodedMessage}`;

    return {
      success: true,
      externalId: `deeplink-${Date.now()}`,
      deepLinkUrl,
    };
  }
}
