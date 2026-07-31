declare global {
  interface Window {
    __META_PIXEL_ID__?: string;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/**
 * Meta Pixel helper.
 * Configura window.__META_PIXEL_ID__ en index.html con el ID de Events Manager.
 */
export class MetaPixelService {
  private static initialized = false;

  public static getPixelId(): string {
    return String(window.__META_PIXEL_ID__ || "").trim();
  }

  public static init(): void {
    if (this.initialized) return;

    const pixelId = this.getPixelId();
    if (!pixelId || typeof window === "undefined") return;

    if (!window.fbq) {
      const stub = function (...args: unknown[]) {
        (stub as unknown as { queue: unknown[] }).queue.push(args);
      } as ((...args: unknown[]) => void) & { queue: unknown[]; loaded?: boolean; version?: string };
      stub.queue = [];
      stub.loaded = true;
      stub.version = "2.0";
      window.fbq = stub;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(script, first);
    }

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
    this.initialized = true;
  }

  public static track(eventName: string, params?: Record<string, unknown>): void {
    this.init();
    if (!this.getPixelId() || !window.fbq) return;
    if (params) {
      window.fbq("track", eventName, params);
      return;
    }
    window.fbq("track", eventName);
  }

  public static trackCustom(eventName: string, params?: Record<string, unknown>): void {
    this.init();
    if (!this.getPixelId() || !window.fbq) return;
    if (params) {
      window.fbq("trackCustom", eventName, params);
      return;
    }
    window.fbq("trackCustom", eventName);
  }

  public static trackViewContent(): void {
    this.track("ViewContent", {
      content_name: "Landing Promo Peru",
      content_category: "Subscription Trial",
      currency: "PEN",
    });
  }

  public static trackCompleteRegistration(): void {
    this.track("CompleteRegistration", {
      status: true,
      currency: "PEN",
    });
  }

  public static trackStartTrial(): void {
    this.track("StartTrial", {
      value: 0,
      currency: "PEN",
      predicted_ltv: 0,
    });
  }
}
