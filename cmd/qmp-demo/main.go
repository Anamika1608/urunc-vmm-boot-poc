package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"path/filepath"
	"time"

	"github.com/Anamika1608/urunc-vmm-boot-poc/pkg/vmm/qemu"
)

func main() {
	ctx := context.Background()
	socketPath := filepath.Join("/tmp", fmt.Sprintf("qmp-demo-%d.sock", time.Now().UnixNano()))
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		panic(err)
	}
	defer ln.Close()

	go serveQMPMock(ln)

	client := qemu.NewQMPClient(socketPath)
	if err := client.Connect(ctx, time.Second); err != nil {
		panic(err)
	}
	defer client.Close()
	if err := client.Negotiate(ctx); err != nil {
		panic(err)
	}
	if err := client.Cont(ctx); err != nil {
		panic(err)
	}
	fmt.Println("QMP handshake succeeded and cont was accepted")
}

func serveQMPMock(ln net.Listener) {
	conn, err := ln.Accept()
	if err != nil {
		return
	}
	defer conn.Close()
	conn.Write([]byte(`{"QMP":{"version":{"qemu":{"major":9,"minor":0,"micro":0},"package":""},"capabilities":[]}}` + "\r\n"))
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		var req map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			conn.Write([]byte(`{"error":{"class":"GenericError","desc":"bad json"}}` + "\r\n"))
			continue
		}
		conn.Write([]byte(fmt.Sprintf(`{"return":{},"id":%v}`+"\r\n", req["id"])))
	}
}
