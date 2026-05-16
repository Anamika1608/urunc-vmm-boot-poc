package qemu

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"path/filepath"
	"testing"
	"time"
)

func TestQMPHandshakeAndCont(t *testing.T) {
	socketPath := filepath.Join(t.TempDir(), "qmp.sock")
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	got := make(chan string, 2)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		conn.Write([]byte(`{"QMP":{"version":{"qemu":{"major":9,"minor":0,"micro":0},"package":""},"capabilities":[]}}` + "\r\n"))
		scanner := bufio.NewScanner(conn)
		for scanner.Scan() {
			var req map[string]any
			_ = json.Unmarshal(scanner.Bytes(), &req)
			got <- req["execute"].(string)
			conn.Write([]byte(`{"return":{}}` + "\r\n"))
		}
	}()

	client := NewQMPClient(socketPath)
	if err := client.Connect(context.Background(), 250*time.Millisecond); err != nil {
		t.Fatalf("Connect returned error: %v", err)
	}
	defer client.Close()
	if err := client.Negotiate(context.Background()); err != nil {
		t.Fatalf("Negotiate returned error: %v", err)
	}
	if err := client.Cont(context.Background()); err != nil {
		t.Fatalf("Cont returned error: %v", err)
	}

	if first, second := <-got, <-got; first != "qmp_capabilities" || second != "cont" {
		t.Fatalf("unexpected commands: %q, %q", first, second)
	}
}
