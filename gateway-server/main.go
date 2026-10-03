package main

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultPort      = "5060"
	defaultPosID     = 189142
	defaultAuthToken = "b2128532-1041-39bd-8128-8049e87a270b"
	fbrGatewayURL    = "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"
	fbrHost          = "gw.fbr.gov.pk"
	fbrPort          = "443"
)

// UpstreamFbrHealth reports socket reachability to FBR
type UpstreamFbrHealth struct {
	Status    string `json:"status"`
	Endpoint  string `json:"endpoint"`
	IP        string `json:"ip,omitempty"`
	LatencyMS *int64 `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

// HealthResponse returned by /api/health
type HealthResponse struct {
	Status      string            `json:"status"`
	Service     string            `json:"service"`
	Environment string            `json:"environment"`
	Port        int               `json:"port"`
	PosID       string            `json:"pos_id"`
	UpstreamFbr UpstreamFbrHealth `json:"upstream_fbr"`
	Timestamp   string            `json:"timestamp"`
}

// FBRItem matches FBR item specification
type FBRItem struct {
	ItemCode    string  `json:"ItemCode"`
	ItemName    string  `json:"ItemName"`
	PCTCode     string  `json:"PCTCode"`
	Quantity    float64 `json:"Quantity"`
	TaxRate     float64 `json:"TaxRate"`
	SaleValue   float64 `json:"SaleValue"`
	Discount    float64 `json:"Discount"`
	FurtherTax  float64 `json:"FurtherTax"`
	TaxCharged  float64 `json:"TaxCharged"`
	TotalAmount float64 `json:"TotalAmount"`
	InvoiceType int     `json:"InvoiceType"`
	RefUSIN     *string `json:"RefUSIN"`
}

// probeUpstreamFBR verifies direct TLS socket connectivity to gw.fbr.gov.pk
func probeUpstreamFBR(timeout time.Duration) UpstreamFbrHealth {
	start := time.Now()
	dialer := &net.Dialer{Timeout: timeout}
	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(fbrHost, fbrPort), &tls.Config{
		ServerName: fbrHost,
	})

	if err != nil {
		return UpstreamFbrHealth{
			Status:    "unreachable",
			Endpoint:  fbrGatewayURL,
			LatencyMS: nil,
			Error:     err.Error(),
		}
	}
	defer conn.Close()

	latency := time.Since(start).Milliseconds()
	remoteIP := conn.RemoteAddr().String()
	if host, _, err := net.SplitHostPort(remoteIP); err == nil {
		remoteIP = host
	}

	return UpstreamFbrHealth{
		Status:    "online",
		Endpoint:  fbrGatewayURL,
		IP:        remoteIP,
		LatencyMS: &latency,
	}
}

// formatFBRDate formats date to "YYYY-MM-DD HH:mm:ss"
func formatFBRDate(input string) string {
	if strings.TrimSpace(input) == "" {
		return time.Now().Format("2006-01-02 15:04:05")
	}
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05.999Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, input); err == nil {
			return t.Format("2006-01-02 15:04:05")
		}
	}
	return input
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	portNum, _ := strconv.Atoi(port)
	if portNum == 0 {
		portNum = 5060
	}

	posID := defaultPosID
	if envPos := os.Getenv("FBR_POS_ID"); envPos != "" {
		if id, err := strconv.Atoi(envPos); err == nil && id > 0 {
			posID = id
		}
	}

	authToken := os.Getenv("FBR_POS_AUTH_TOKEN")
	if authToken == "" {
		authToken = defaultAuthToken
	}

	fmt.Println("=======================================================")
	fmt.Println("  AK Retail POS — FBR Local Gateway (Windows Native)")
	fmt.Printf("  Target Port: %s\n", port)
	fmt.Printf("  POS ID: %d\n", posID)
	fmt.Println("  Upstream: gw.fbr.gov.pk:443 (Domestic Pakistan IP)")
	fmt.Println("=======================================================")

	httpClient := &http.Client{
		Timeout: 8 * time.Second,
	}

	mux := http.NewServeMux()

	// Global Handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log every incoming request immediately so the user can see connection attempts
		log.Printf("[Incoming] %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

		// Set CORS and Chrome Private Network Access (PNA) Headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		path := r.URL.Path

		// 1. Healthcheck endpoints
		if r.Method == http.MethodGet && (path == "/api/health" || path == "/api/local-fbr/health" || path == "/api/fbr/health" || path == "/health" || path == "/") {
			upstream := probeUpstreamFBR(2500 * time.Millisecond)
			status := "online"
			if upstream.Status != "online" {
				status = "warning"
			}

			resp := HealthResponse{
				Status:      status,
				Service:     "fbr-local-proxy",
				Environment: "local_pakistan_ip",
				Port:        portNum,
				PosID:       strconv.Itoa(posID),
				UpstreamFbr: upstream,
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(resp)
			latencyStr := "unknown"
			if upstream.LatencyMS != nil {
				latencyStr = fmt.Sprintf("%dms", *upstream.LatencyMS)
			}
			log.Printf("[Health] Responded: status=%s upstream_fbr=%s", status, latencyStr)
			return
		}

		// 2. Submit invoice endpoints
		if r.Method == http.MethodPost && (path == "/api/fbr/submit-invoice" || path == "/api/local-fbr/submit-invoice" || path == "/api/submit-invoice" || path == "/api/ims/submit-invoice") {
			bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte(`{"success":false,"Code":"400","Response":"Failed to read request body"}`))
				return
			}

			var rawMap map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &rawMap); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte(`{"success":false,"Code":"400","Response":"Invalid JSON payload"}`))
				return
			}

			usin, _ := rawMap["USIN"].(string)
			if usin == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte(`{"success":false,"Code":"102","Response":"USIN is required in invoice payload"}`))
				return
			}

			log.Printf("[Invoice] Received submission: USIN=%s", usin)

			// Normalize POSID
			if p, ok := rawMap["POSID"].(float64); !ok || p == 0 {
				rawMap["POSID"] = posID
			}

			// Normalize DateTime format
			if dt, ok := rawMap["DateTime"].(string); ok {
				rawMap["DateTime"] = formatFBRDate(dt)
			} else {
				rawMap["DateTime"] = time.Now().Format("2006-01-02 15:04:05")
			}

			fbrReqBody, err := json.Marshal(rawMap)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"success":false,"Code":"500","Response":"Failed to encode FBR payload"}`))
				return
			}

			log.Printf("[FBR Dispatch] Sending to %s...", fbrGatewayURL)
			tStart := time.Now()

			fbrReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, fbrGatewayURL, bytes.NewBuffer(fbrReqBody))
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				fmt.Fprintf(w, `{"success":false,"Code":"500","Response":"Failed to create FBR request: %s"}`, err.Error())
				return
			}

			fbrReq.Header.Set("Content-Type", "application/json")
			fbrReq.Header.Set("Accept", "application/json")
			fbrReq.Header.Set("Authorization", "Bearer "+authToken)

			fbrResp, err := httpClient.Do(fbrReq)
			durationMS := time.Since(tStart).Milliseconds()

			if err != nil {
				log.Printf("[FBR Error] Connection failed after %dms: %v", durationMS, err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				fmt.Fprintf(w, `{"success":false,"Code":"504","Response":"FBR Connection Error: %s","duration_ms":%d}`, err.Error(), durationMS)
				return
			}
			defer fbrResp.Body.Close()

			fbrRespBody, _ := io.ReadAll(fbrResp.Body)
			log.Printf("[FBR Response] Status=%d in %dms", fbrResp.StatusCode, durationMS)

			var fbrInvoiceNumber string
			trimmedResp := strings.TrimSpace(string(fbrRespBody))

			var parsedResp map[string]interface{}
			if err := json.Unmarshal(fbrRespBody, &parsedResp); err == nil {
				if num, ok := parsedResp["InvoiceNumber"].(string); ok && num != "" {
					fbrInvoiceNumber = num
				} else if num, ok := parsedResp["FBRInvoiceNumber"].(string); ok && num != "" {
					fbrInvoiceNumber = num
				} else if num, ok := parsedResp["fbrInvoiceNumber"].(string); ok && num != "" {
					fbrInvoiceNumber = num
				} else if code, ok := parsedResp["Code"].(string); ok && code == "100" {
					if res, ok := parsedResp["Response"].(string); ok {
						fbrInvoiceNumber = res
					}
				}
			} else {
				if !strings.HasPrefix(trimmedResp, "{") && !strings.HasPrefix(trimmedResp, "<") && len(trimmedResp) > 5 && len(trimmedResp) < 40 {
					fbrInvoiceNumber = trimmedResp
				}
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)

			if fbrInvoiceNumber != "" {
				log.Printf("[SUCCESS] Official FBR Invoice Number: %s (%dms)", fbrInvoiceNumber, durationMS)
				fmt.Fprintf(w, `{"success":true,"Code":"100","Response":"Invoice received successfully","FBRInvoiceNumber":"%s","fbrInvoiceNumber":"%s","duration_ms":%d}`,
					fbrInvoiceNumber, fbrInvoiceNumber, durationMS)
			} else {
				errorMsg := "Failed to submit to FBR"
				errorCode := strconv.Itoa(fbrResp.StatusCode)
				if parsedResp != nil {
					if respText, ok := parsedResp["Response"].(string); ok && respText != "" {
						errorMsg = respText
					} else if msg, ok := parsedResp["Message"].(string); ok && msg != "" {
						errorMsg = msg
					}
					if c, ok := parsedResp["Code"].(string); ok && c != "" {
						errorCode = c
					}
				} else if len(trimmedResp) > 0 && len(trimmedResp) < 200 {
					errorMsg = trimmedResp
				}

				log.Printf("[FBR Error Response] Code=%s Msg=%s", errorCode, errorMsg)
				errJSON, _ := json.Marshal(map[string]interface{}{
					"success":          false,
					"Code":             errorCode,
					"Response":         errorMsg,
					"FBRInvoiceNumber": nil,
					"fbrInvoiceNumber": nil,
					"duration_ms":      durationMS,
					"raw":              string(fbrRespBody),
				})
				w.Write(errJSON)
			}
			return
		}

		// 404 fallback
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"Endpoint not found on FBR Local Gateway"}`))
	})

	mux.Handle("/", handler)

	server := &http.Server{
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Bind listeners explicitly to both IPv4 and IPv6 to prevent socket ambiguity
	var listeners []net.Listener

	// 1. IPv4 (0.0.0.0 binds to all IPv4 addresses including 127.0.0.1 and LAN IPs)
	l4, err4 := net.Listen("tcp4", "0.0.0.0:"+port)
	if err4 != nil {
		log.Printf("[Warning] Failed to bind IPv4 (0.0.0.0:%s): %v", port, err4)
	} else {
		listeners = append(listeners, l4)
		log.Printf("[Listener] IPv4 Active: http://127.0.0.1:%s", port)
	}

	// 2. IPv6 ([::] binds to IPv6 including [::1] loopback)
	l6, err6 := net.Listen("tcp6", "[::]:"+port)
	if err6 != nil {
		// IPv6 may be disabled on some Windows configurations; safe to ignore if IPv4 succeeded
	} else {
		listeners = append(listeners, l6)
		log.Printf("[Listener] IPv6 Active: http://[::1]:%s", port)
	}

	if len(listeners) == 0 {
		fmt.Printf("\n[FATAL ERROR] Port %s is already in use by another application!\n", port)
		fmt.Printf("Possible causes:\n")
		fmt.Printf("1. Another instance of fbr-gateway.exe or node.js is already running.\n")
		fmt.Printf("2. Open Task Manager and end any running 'fbr-gateway.exe' or 'node.exe' processes.\n\n")
		fmt.Println("Press Enter to close...")
		bufio.NewReader(os.Stdin).ReadBytes('\n')
		os.Exit(1)
	}

	fmt.Println("-------------------------------------------------------")
	fmt.Println("  Gateway is ONLINE and READY for cashier sales.")
	fmt.Println("  Do NOT close this window during retail store hours.")
	fmt.Println("-------------------------------------------------------")

	var wg sync.WaitGroup
	for _, l := range listeners {
		wg.Add(1)
		go func(listener net.Listener) {
			defer wg.Done()
			if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
				log.Printf("[Listener Error] %v", err)
			}
		}(l)
	}

	wg.Wait()
}
