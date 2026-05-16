package vmm

import (
	"context"
	"time"
)

type ExecArgs struct {
	ContainerID   string
	UnikernelPath string
	InitrdPath    string
	CommandLine   string
	MemSizeMiB    uint64
	VCPUs         uint
	APIPath       string
	QMPPath       string
	Net           NetIface
	Drives        []Drive
}

type NetIface struct {
	ID       string
	GuestMAC string
	HostDev  string
}

type Drive struct {
	ID           string
	Path         string
	IsRootDevice bool
	IsReadOnly   bool
}

type SocketBootVMM interface {
	StartVMM(ctx context.Context, args ExecArgs) error
	WaitForSocket(timeout time.Duration) error
	Configure(ctx context.Context, args ExecArgs) error
	StartGuest(ctx context.Context) error
}
