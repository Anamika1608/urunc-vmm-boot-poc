package qemu

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

type QMPClient struct {
	socketPath string
	conn       net.Conn
	reader     *bufio.Reader
	mu         sync.Mutex
	nextID     int
}

type command struct {
	Execute   string         `json:"execute"`
	Arguments map[string]any `json:"arguments,omitempty"`
	ID        int            `json:"id"`
}

type response struct {
	Return json.RawMessage `json:"return,omitempty"`
	Error  *qmpError       `json:"error,omitempty"`
	ID     int             `json:"id,omitempty"`
}

type qmpError struct {
	Class string `json:"class"`
	Desc  string `json:"desc"`
}

func NewQMPClient(socketPath string) *QMPClient {
	return &QMPClient{socketPath: socketPath}
}

func (q *QMPClient) Connect(ctx context.Context, timeout time.Duration) error {
	dialer := net.Dialer{Timeout: timeout}
	conn, err := dialer.DialContext(ctx, "unix", q.socketPath)
	if err != nil {
		return fmt.Errorf("connect qmp socket %q: %w", q.socketPath, err)
	}
	q.conn = conn
	q.reader = bufio.NewReader(conn)
	if _, err := q.reader.ReadBytes('\n'); err != nil {
		_ = conn.Close()
		return fmt.Errorf("read qmp greeting: %w", err)
	}
	return nil
}

func (q *QMPClient) Close() error {
	if q.conn == nil {
		return nil
	}
	return q.conn.Close()
}

func (q *QMPClient) Negotiate(ctx context.Context) error {
	return q.Execute(ctx, "qmp_capabilities", nil)
}

func (q *QMPClient) Cont(ctx context.Context) error {
	return q.Execute(ctx, "cont", nil)
}

func (q *QMPClient) SystemPowerdown(ctx context.Context) error {
	return q.Execute(ctx, "system_powerdown", nil)
}

func (q *QMPClient) NetdevAdd(ctx context.Context, args map[string]any) error {
	return q.Execute(ctx, "netdev_add", args)
}

func (q *QMPClient) BlockdevAdd(ctx context.Context, args map[string]any) error {
	return q.Execute(ctx, "blockdev-add", args)
}

func (q *QMPClient) DeviceAdd(ctx context.Context, args map[string]any) error {
	return q.Execute(ctx, "device_add", args)
}

func (q *QMPClient) Execute(ctx context.Context, name string, args map[string]any) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.conn == nil || q.reader == nil {
		return fmt.Errorf("qmp client is not connected")
	}
	q.nextID++
	cmd := command{Execute: name, Arguments: args, ID: q.nextID}
	payload, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("marshal qmp command %s: %w", name, err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = q.conn.SetDeadline(deadline)
		defer q.conn.SetDeadline(time.Time{})
	}
	if _, err := q.conn.Write(append(payload, '\n')); err != nil {
		return fmt.Errorf("write qmp command %s: %w", name, err)
	}
	for {
		line, err := q.reader.ReadBytes('\n')
		if err != nil {
			return fmt.Errorf("read qmp response for %s: %w", name, err)
		}
		var resp response
		if err := json.Unmarshal(line, &resp); err != nil {
			return fmt.Errorf("decode qmp response for %s: %w", name, err)
		}
		if resp.ID != 0 && resp.ID != cmd.ID {
			continue
		}
		if resp.Error != nil {
			return fmt.Errorf("qmp %s failed: %s: %s", name, resp.Error.Class, resp.Error.Desc)
		}
		return nil
	}
}
