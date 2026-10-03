import http from 'node:http';
import tls from 'node:tls';

// Ignore SIGHUP so closing or exiting the launcher terminal window does NOT terminate the proxy
process.on('SIGHUP', () => {
  // daemon remains running
});

process.on('uncaughtException', (err) => {
  console.error('[Local Proxy] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Local Proxy] Unhandled Rejection:', reason);
});

const PORT = Number(process.env.PORT || 5060);
const FBR_POS_ID = Number(process.env.FBR_POS_ID || 189142);
const FBR_AUTH_TOKEN = process.env.FBR_POS_AUTH_TOKEN || 'b2128532-1041-39bd-8128-8049e87a270b';
const FBR_GATEWAY_URL = process.env.FBR_IMSP_URL || 'https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData';
const FBR_HOST = 'gw.fbr.gov.pk';
const FBR_PORT = 443;

/**
 * Actively probe upstream FBR gateway over TLS
 * Returns latency in ms and reachability status
 */
async function probeUpstreamFbr(timeoutMs = 2500) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    let resolved = false;

    const socket = tls.connect(
      {
        host: FBR_HOST,
        port: FBR_PORT,
        servername: FBR_HOST,
        timeout: timeoutMs,
      },
      () => {
        if (!resolved) {
          resolved = true;
          const latency = Date.now() - startTime;
          const ip = socket.remoteAddress;
          socket.destroy();
          resolve({
            status: 'online',
            endpoint: FBR_GATEWAY_URL,
            ip: ip || '103.125.60.111',
            latency_ms: latency,
            error: null,
          });
        }
      }
    );

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({
          status: 'unreachable',
          endpoint: FBR_GATEWAY_URL,
          latency_ms: null,
          error: `Connection to ${FBR_HOST}:${FBR_PORT} timed out (${timeoutMs}ms)`,
        });
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({
          status: 'unreachable',
          endpoint: FBR_GATEWAY_URL,
          latency_ms: null,
          error: err.message,
        });
      }
    });
  });
}

/**
 * Format date for FBR IMS specifications: "YYYY-MM-DD HH:mm:ss"
 */
function formatFBRDate(inputDate) {
  if (!inputDate) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }
  try {
    const d = new Date(inputDate);
    if (isNaN(d.getTime())) return inputDate;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return inputDate;
  }
}

/**
 * Read request body helper
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS & Chrome Private Network Access (PNA) Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Healthcheck Endpoints
  if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api/fbr/health' || pathname === '/health')) {
    const upstream = await probeUpstreamFbr();
    const isHealthy = upstream.status === 'online';

    const healthPayload = {
      status: isHealthy ? 'online' : 'warning',
      service: 'fbr-local-proxy',
      environment: 'local_pakistan_ip',
      pos_id: String(FBR_POS_ID),
      upstream_fbr: upstream,
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthPayload, null, 2));
    return;
  }

  // 2. Submit Invoice Endpoints
  if (req.method === 'POST' && (pathname === '/api/fbr/submit-invoice' || pathname === '/api/submit-invoice' || pathname === '/api/ims/submit-invoice')) {
    try {
      const rawPayload = await readBody(req);
      console.log(`[Local Proxy] Received submission for USIN: ${rawPayload?.USIN || 'NONE'}`);

      if (!rawPayload || !rawPayload.USIN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          Code: '102',
          Response: 'USIN is required in invoice payload',
          FBRInvoiceNumber: null,
          fbrInvoiceNumber: null,
        }));
        return;
      }

      // Format payload to strictly match FBR Tier-1 schema
      const formattedDate = formatFBRDate(rawPayload.DateTime);
      const payload = {
        InvoiceNumber: rawPayload.InvoiceNumber || '',
        POSID: rawPayload.POSID ? Number(rawPayload.POSID) : FBR_POS_ID,
        USIN: String(rawPayload.USIN || ''),
        DateTime: formattedDate,
        BuyerNTN: rawPayload.BuyerNTN || '',
        BuyerCNIC: rawPayload.BuyerCNIC || '',
        BuyerName: rawPayload.BuyerName || 'Walk-in Customer',
        BuyerPhoneNumber: rawPayload.BuyerPhoneNumber || '',
        TotalBillAmount: Number(Number(rawPayload.TotalBillAmount || 0).toFixed(2)),
        TotalQuantity: Number(rawPayload.TotalQuantity || 1),
        TotalSaleValue: Number(Number(rawPayload.TotalSaleValue || 0).toFixed(2)),
        TotalTaxCharged: Number(Number(rawPayload.TotalTaxCharged || 0).toFixed(2)),
        Discount: Number(Number(rawPayload.Discount || 0).toFixed(2)),
        FurtherTax: Number(Number(rawPayload.FurtherTax || 0).toFixed(2)),
        PaymentMode: Number(rawPayload.PaymentMode || 1),
        InvoiceType: Number(rawPayload.InvoiceType || 1),
        RefUSIN: rawPayload.RefUSIN || null,
        Items: (rawPayload.Items || []).map((it) => ({
          ItemCode: String(it.ItemCode || ''),
          ItemName: String(it.ItemName || 'Item'),
          PCTCode: String(it.PCTCode || '01011000'),
          Quantity: Number(it.Quantity || 1),
          TaxRate: Number(it.TaxRate || 0),
          SaleValue: Number(Number(it.SaleValue || 0).toFixed(2)),
          Discount: Number(Number(it.Discount || 0).toFixed(2)),
          FurtherTax: Number(Number(it.FurtherTax || 0).toFixed(2)),
          TaxCharged: Number(Number(it.TaxCharged || 0).toFixed(2)),
          TotalAmount: Number(Number(it.TotalAmount || 0).toFixed(2)),
          InvoiceType: Number(it.InvoiceType || rawPayload.InvoiceType || 1),
          RefUSIN: it.RefUSIN || rawPayload.RefUSIN || null,
        })),
      };

      console.log(`[Local Proxy] Dispatching to FBR ${FBR_GATEWAY_URL} (Domestic Pakistan IP)`);
      const t0 = Date.now();

      const fbrResponse = await fetch(FBR_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${FBR_AUTH_TOKEN}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000), // 8s safety timeout
      });

      const responseDuration = Date.now() - t0;
      console.log(`[Local Proxy] FBR responded in ${responseDuration}ms with status: ${fbrResponse.status}`);

      const responseText = await fbrResponse.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }

      if (fbrResponse.ok) {
        let fbrInvoiceNumber = '';
        if (typeof data === 'string') {
          if (data.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(data);
              fbrInvoiceNumber = parsed.InvoiceNumber || parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || '';
            } catch {
              fbrInvoiceNumber = data.trim();
            }
          } else {
            fbrInvoiceNumber = data.trim();
          }
        } else if (typeof data === 'number') {
          fbrInvoiceNumber = String(data);
        } else if (data && typeof data === 'object') {
          fbrInvoiceNumber = data.InvoiceNumber || data.FBRInvoiceNumber || data.fbrInvoiceNumber || '';
        }

        if (fbrInvoiceNumber) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            Code: '100',
            Response: 'Invoice received successfully',
            FBRInvoiceNumber: fbrInvoiceNumber,
            fbrInvoiceNumber: fbrInvoiceNumber,
            duration_ms: responseDuration,
            raw: data,
          }));
          return;
        }
      }

      // If FBR returned an error structure
      let errorMsg = 'Failed to submit to FBR';
      let errorCode = String(fbrResponse.status);

      if (data && typeof data === 'object') {
        if (data.fault && data.fault.description) {
          errorMsg = data.fault.description;
          errorCode = String(data.fault.code || fbrResponse.status);
        } else if (data.Response) {
          errorMsg = data.Response;
          errorCode = String(data.Code || fbrResponse.status);
        } else if (data.Message) {
          errorMsg = data.Message;
        }
      } else if (typeof data === 'string' && data.length < 200) {
        errorMsg = data;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        Code: errorCode,
        Response: errorMsg,
        FBRInvoiceNumber: null,
        fbrInvoiceNumber: null,
        duration_ms: responseDuration,
        raw: data,
      }));
    } catch (err) {
      console.error(`[Local Proxy] Exception handling submission:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        Code: '500',
        Response: `Local Proxy Error: ${err.message}`,
        FBRInvoiceNumber: null,
        fbrInvoiceNumber: null,
      }));
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found on fbr-local-proxy' }));
});

server.listen(PORT, '::', () => {
  console.log(`=======================================================`);
  console.log(`🚀 FBR Local Gateway Running on Port ${PORT}`);
  console.log(`📍 Environment: Local Shop (Domestic Pakistan IP)`);
  console.log(`🔗 Healthcheck: http://localhost:${PORT}/api/health (IPv4 & IPv6 Dual-Stack)`);
  console.log(`=======================================================`);
});
