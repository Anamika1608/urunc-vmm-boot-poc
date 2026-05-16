package firecracker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	vmm "github.com/Anamika1608/urunc-vmm-boot-poc/pkg/vmm"
)

type Client struct {
	socketPath string
	httpClient *http.Client
	cmd        *exec.Cmd
}

type MachineConfig struct {
	VcpuCount       uint   `json:"vcpu_count"`
	MemSizeMiB      uint64 `json:"mem_size_mib"`
	Smt             bool   `json:"smt"`
	TrackDirtyPages bool   `json:"track_dirty_pages"`
}

type BootSource struct {
	KernelImagePath string `json:"kernel_image_path"`
	BootArgs        string `json:"boot_args"`
	InitrdPath      string `json:"initrd_path,omitempty"`
}

type Drive struct {
	DriveID      string `json:"drive_id"`
	IsRootDevice bool   `json:"is_root_device"`
	IsReadOnly   bool   `json:"is_read_only"`
	PathOnHost   string `json:"path_on_host"`
}

type NetIface struct {
	IfaceID     string `json:"iface_id"`
	GuestMAC    string `json:"guest_mac,omitempty"`
	HostDevName string `json:"host_dev_name"`
}

type action struct {
	ActionType string `json:"action_type"`
}

func NewClient(socketPath string) *Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socketPath)
		},
	}
	return &Client{
		socketPath: socketPath,
		httpClient: &http.Client{Transport: transport},
	}
}

func (c *Client) StartVMM(ctx context.Context, args vmm.ExecArgs) error {
	socketPath := args.APIPath
	if socketPath == "" {
		socketPath = c.socketPath
	}
	if socketPath == "" {
		return fmt.Errorf("firecracker API socket path is required")
	}
	if err := os.RemoveAll(socketPath); err != nil {
		return fmt.Errorf("remove stale socket: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(socketPath), 0o755); err != nil {
		return fmt.Errorf("create socket directory: %w", err)
	}
	c.socketPath = socketPath
	c.cmd = exec.CommandContext(ctx, "firecracker", "--api-sock", socketPath)
	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("start firecracker: %w", err)
	}
	return nil
}

func (c *Client) WaitReady(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("unix", c.socketPath, 20*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		lastErr = err
		time.Sleep(10 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = context.DeadlineExceeded
	}
	return fmt.Errorf("firecracker API socket %q not ready within %s: %w", c.socketPath, timeout, lastErr)
}

func (c *Client) WaitForSocket(timeout time.Duration) error {
	return c.WaitReady(timeout)
}

func (c *Client) Configure(ctx context.Context, args vmm.ExecArgs) error {
	mem := args.MemSizeMiB
	if mem == 0 {
		mem = 256
	}
	vcpus := args.VCPUs
	if vcpus == 0 {
		vcpus = 1
	}
	if err := c.ConfigureMachine(ctx, MachineConfig{
		VcpuCount:       vcpus,
		MemSizeMiB:      mem,
		Smt:             false,
		TrackDirtyPages: false,
	}); err != nil {
		return err
	}
	if err := c.SetBootSource(ctx, args.UnikernelPath, args.InitrdPath, args.CommandLine); err != nil {
		return err
	}
	for _, d := range args.Drives {
		if err := c.AddDrive(ctx, Drive{
			DriveID:      d.ID,
			IsRootDevice: d.IsRootDevice,
			IsReadOnly:   d.IsReadOnly,
			PathOnHost:   d.Path,
		}); err != nil {
			return err
		}
	}
	if args.Net.ID != "" && args.Net.HostDev != "" {
		if err := c.AddNetworkInterface(ctx, NetIface{
			IfaceID:     args.Net.ID,
			GuestMAC:    args.Net.GuestMAC,
			HostDevName: args.Net.HostDev,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) ConfigureMachine(ctx context.Context, cfg MachineConfig) error {
	return c.put(ctx, "/machine-config", cfg)
}

func (c *Client) SetBootSource(ctx context.Context, kernel, initrd, cmdline string) error {
	return c.put(ctx, "/boot-source", BootSource{
		KernelImagePath: kernel,
		InitrdPath:      initrd,
		BootArgs:        cmdline,
	})
}

func (c *Client) AddDrive(ctx context.Context, drive Drive) error {
	return c.put(ctx, "/drives/"+drive.DriveID, drive)
}

func (c *Client) AddNetworkInterface(ctx context.Context, iface NetIface) error {
	return c.put(ctx, "/network-interfaces/"+iface.IfaceID, iface)
}

func (c *Client) StartGuest(ctx context.Context) error {
	return c.put(ctx, "/actions", action{ActionType: "InstanceStart"})
}

func (c *Client) put(ctx context.Context, path string, body any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal %s request: %w", path, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, "http://localhost"+path, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build %s request: %w", path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send %s request: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%s returned HTTP %d", path, resp.StatusCode)
	}
	return nil
}
