# urunc VMM Socket Boot PoC

This repository is a small proof of concept for urunc issue
[#112](https://github.com/urunc-dev/urunc/issues/112), "Change the way we boot
the VMM".

The current urunc path builds a complete monitor command and then lets the
reexec process `execve` into the VMM. Firecracker is launched with `--no-api
--config-file`, and QEMU disables the monitor with `-monitor null`. That keeps
the boot flow simple, but it also makes the VMM a single late blocking step.

The PoC shows the shape of a socket-first design:

1. Start the VMM process early with a Unix control socket.
2. Let urunc continue network, rootfs, hook, and device setup in parallel.
3. Configure the guest through the socket once setup results are known.
4. Send the final guest-start command only after OCI start ordering allows it.

## Contents

- `pkg/vmm/interface.go`: proposed split VMM interface.
- `pkg/vmm/firecracker/client.go`: Firecracker HTTP-over-Unix-socket client.
- `pkg/vmm/qemu/qmp.go`: small QMP client with handshake and `cont`.
- `cmd/fc-socket-demo`: mock Firecracker API socket demo.
- `cmd/qmp-demo`: mock QMP handshake demo.
- `benchmarks`: synthetic sequential versus overlapped timing benchmark.

## Run

```sh
go test ./...
go run ./cmd/fc-socket-demo
go run ./cmd/qmp-demo
go test ./benchmarks -bench .
```

## Synthetic Result

The Firecracker synthetic timing model uses a 140 ms Firecracker setup phase, a
140 ms urunc setup phase, and a 70 ms guest boot phase. The QEMU model uses a
220 ms QEMU setup phase, a 220 ms urunc setup phase, and a 160 ms guest boot
phase.

| VMM | Before | After | Saved | Improvement |
| --- | ---: | ---: | ---: | ---: |
| Firecracker | 350 ms | 210 ms | 140 ms | 40% |
| QEMU | 600 ms | 380 ms | 220 ms | 37% |

These numbers are not a replacement for real KVM benchmarking. They show the
critical-path math: the proposed design saves the shorter of the overlapped VMM
startup and urunc setup phases.
