import { IWhatsAppProvider, SendMessageResult } from "./provider.interface";

export class FonnteWhatsAppProvider implements IWhatsAppProvider {
  readonly id = "fonnte";
  readonly name = "Fonnte WhatsApp API Gateway";

  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint = "https://api.fonnte.com/send") {
    this.apiKey = apiKey || process.env.FONNTE_API_KEY || "";
    this.endpoint = endpoint;
  }

  async sendMessage(recipient: string, message: string): Promise<SendMessageResult> {
    if (!this.apiKey) {
      return {
        success: false,
        errorMessage: "API Key Fonnte belum dikonfigurasi pada environment (FONNTE_API_KEY)",
      };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: recipient,
          message: message,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || (data && data.status === false)) {
        return {
          success: false,
          errorMessage: data?.reason || data?.message || `Fonnte HTTP Error: ${response.status}`,
        };
      }

      return {
        success: true,
        externalId: data?.id || `fonnte-${Date.now()}`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorMessage: `Koneksi Fonnte gagal: ${errorMsg}`,
      };
    }
  }
}
