import { IWhatsAppProvider, SendMessageResult } from "./provider.interface";

export class WahaWhatsAppProvider implements IWhatsAppProvider {
  readonly id = "waha";
  readonly name = "WAHA (WhatsApp HTTP API)";

  private endpointUrl: string;
  private sessionKey: string;

  constructor(endpointUrl?: string, sessionKey?: string) {
    this.endpointUrl = endpointUrl || process.env.WAHA_ENDPOINT_URL || "http://localhost:3000/api/sendText";
    this.sessionKey = sessionKey || process.env.WAHA_SESSION_KEY || "default";
  }

  async sendMessage(recipient: string, message: string): Promise<SendMessageResult> {
    const formattedChatId = recipient.endsWith("@c.us") ? recipient : `${recipient}@c.us`;

    try {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: formattedChatId,
          text: message,
          session: this.sessionKey,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          errorMessage: data?.message || `WAHA HTTP Error: ${response.status}`,
        };
      }

      return {
        success: true,
        externalId: data?.id?._serialized || data?.id || `waha-${Date.now()}`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorMessage: `Koneksi WAHA gagal: ${errorMsg}`,
      };
    }
  }
}
