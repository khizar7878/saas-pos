export interface TcsCheckpoint {
  consignmentno: string;
  datetime: string;
  recievedby: string;
  status: string;
}

export interface TcsShipmentInfo {
  consignmentno: string;
  bookingdate: string;
  shipper: string;
  consignee: string;
  origin: string;
  origincountry: string;
  destination: string;
  destinationcountry: string;
  referenceno: string;
}

export interface TcsTrackingResult {
  isSuccess: boolean;
  shipmentinfo?: TcsShipmentInfo[];
  checkpoints?: TcsCheckpoint[];
  shipmentsummary?: string;
  message?: string;
}

/**
 * Fetch live TCS tracking status for a consignment number
 */
export async function fetchTcsTracking(consignmentNo: string): Promise<TcsTrackingResult> {
  const cleanCn = consignmentNo.trim();
  if (!cleanCn) {
    throw new Error("Consignment number is required");
  }

  const payload = {
    body: {
      url: "trackapinew",
      type: "GET",
      param: `consignee=${cleanCn}`,
      payload: {}
    }
  };

  const headers = {
    "Content-Type": "application/json",
  };

  const targetUrl = "https://www.tcsexpress.com/apibridge";

  // Resilient multi-proxy fallback chain for live production websites
  const fetchUrls = [
    `https://cors.eu.org/${targetUrl}`,
    `https://proxy.cors.sh/${targetUrl}`,
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  let lastError: Error | null = null;

  for (const apiUrl of fetchUrls) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }

      if (typeof json === 'string') {
        try { json = JSON.parse(json); } catch {}
      }

      if (json && (json.isSuccess || json.responseData || json.checkpoints)) {
        const data = json.responseData || json;
        return {
          isSuccess: true,
          shipmentinfo: data.shipmentinfo || [],
          checkpoints: data.checkpoints || [],
          shipmentsummary: data.shipmentsummary || "",
          message: data.message || "SUCCESS"
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`TCS Fetch from ${apiUrl} failed:`, err);
    }
  }

  throw lastError || new Error("Failed to fetch TCS tracking details");
}
