package firecracker

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	vmm "github.com/Anamika1608/urunc-vmm-boot-poc/pkg/vmm"
)

func TestWaitReadyConnectsToUnixSocket(t *testing.T) {
	socketPath := shortSocketPath(t, "fc.sock")
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	client := NewClient(socketPath)
	if err := client.WaitReady(250 * time.Millisecond); err != nil {
		t.Fatalf("WaitReady returned error: %v", err)
	}
}

func TestConfigureAndStartGuestSendExpectedRequests(t *testing.T) {
	socketPath := shortSocketPath(t, "fc.sock")
	var requests []string

	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.Method+" "+r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	})}
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	go server.Serve(ln)
	defer server.Shutdown(context.Background())

	client := NewClient(socketPath)
	args := vmm.ExecArgs{
		UnikernelPath: "/kernel",
		InitrdPath:    "/initrd",
		CommandLine:   "console=ttyS0",
		MemSizeMiB:    256,
		VCPUs:         2,
		Net:           vmm.NetIface{ID: "net1", GuestMAC: "06:00:ac:10:00:02", HostDev: "tap0"},
		Drives:        []vmm.Drive{{ID: "rootfs", Path: "/rootfs.ext4", IsRootDevice: true}},
	}
	if err := client.Configure(context.Background(), args); err != nil {
		t.Fatalf("Configure returned error: %v", err)
	}
	if err := client.StartGuest(context.Background()); err != nil {
		t.Fatalf("StartGuest returned error: %v", err)
	}

	want := []string{
		"PUT /machine-config",
		"PUT /boot-source",
		"PUT /drives/rootfs",
		"PUT /network-interfaces/net1",
		"PUT /actions",
	}
	if !reflect.DeepEqual(requests, want) {
		t.Fatalf("requests mismatch\nwant: %#v\n got: %#v", want, requests)
	}
}

func TestWaitReadyTimesOutWhenSocketMissing(t *testing.T) {
	client := NewClient(shortSocketPath(t, "missing.sock"))
	if err := client.WaitReady(10 * time.Millisecond); err == nil {
		t.Fatal("expected timeout error")
	}
}

func shortSocketPath(t *testing.T, name string) string {
	t.Helper()
	dir, err := os.MkdirTemp("/tmp", "fc-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return filepath.Join(dir, name)
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
