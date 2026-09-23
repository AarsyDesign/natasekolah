import { IWhatsAppProvider } from "./provider.interface";
import { DeepLinkWhatsAppProvider } from "./deeplink.provider";
import { FonnteWhatsAppProvider } from "./fonnte.provider";
import { WahaWhatsAppProvider } from "./waha.provider";
import { WhatsAppProviderType } from "../../validation/notification";

export function getWhatsAppProvider(providerType?: WhatsAppProviderType): IWhatsAppProvider {
  const selected = providerType || (process.env.WA_PROVIDER as WhatsAppProviderType) || "DEEPLINK";

  switch (selected.toUpperCase()) {
    case "FONNTE":
      return new FonnteWhatsAppProvider();
    case "WAHA":
      return new WahaWhatsAppProvider();
    case "DEEPLINK":
    default:
      return new DeepLinkWhatsAppProvider();
  }
}
