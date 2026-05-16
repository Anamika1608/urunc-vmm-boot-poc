package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/Anamika1608/urunc-vmm-boot-poc/pkg/vmm"
	"github.com/Anamika1608/urunc-vmm-boot-poc/pkg/vmm/firecracker"
)

func main() {
	ctx := context.Background()
	socketPath := filepath.Join("/tmp", fmt.Sprintf("fc-demo-%d.sock", time.Now().UnixNano()))
	server := mockFirecracker(socketPath)
	defer server.Shutdown(ctx)

	client := firecracker.NewClient(socketPath)
	if err := client.WaitReady(time.Second); err != nil {
		panic(err)
	}

	vmmStartup := 140 * time.Millisecond
	uruncInit := 140 * time.Millisecond
	guestBoot := 70 * time.Millisecond

	sequential := vmmStartup + uruncInit + guestBoot
	parallel := maxDuration(vmmStartup, uruncInit) + guestBoot

	start := time.Now()
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		time.Sleep(vmmStartup)
	}()
	go func() {
		defer wg.Done()
		time.Sleep(uruncInit)
	}()
	wg.Wait()
	if err := client.Configure(ctx, vmm.ExecArgs{
		UnikernelPath: "/tmp/vmlinux",
		CommandLine:   "console=ttyS0 reboot=k panic=1",
		MemSizeMiB:    256,
		VCPUs:         1,
		Net:           vmm.NetIface{ID: "net1", GuestMAC: "06:00:ac:10:00:02", HostDev: "tap0"},
		Drives:        []vmm.Drive{{ID: "rootfs", Path: "/tmp/rootfs.ext4", IsRootDevice: true}},
	}); err != nil {
		panic(err)
	}
	if err := client.StartGuest(ctx); err != nil {
		panic(err)
	}
	elapsed := time.Since(start)

	fmt.Printf("sequential critical path: %s\n", sequential)
	fmt.Printf("parallel critical path:   %s\n", parallel)
	fmt.Printf("simulated saved time:     %s\n", sequential-parallel)
	fmt.Printf("demo wall time:           %s\n", elapsed.Round(time.Millisecond))
}

func mockFirecracker(socketPath string) *http.Server {
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		panic(err)
	}
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})}
	go server.Serve(ln)
	return server
}

func maxDuration(a, b time.Duration) time.Duration {
	if a > b {
		return a
	}
	return b
}
