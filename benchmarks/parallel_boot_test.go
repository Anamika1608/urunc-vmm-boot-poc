package benchmarks

import (
	"testing"
	"time"
)

func sequentialBoot(vmmStartup, uruncInit, guestBoot time.Duration) time.Duration {
	return vmmStartup + uruncInit + guestBoot
}

func parallelBoot(vmmStartup, uruncInit, guestBoot time.Duration) time.Duration {
	if vmmStartup > uruncInit {
		return vmmStartup + guestBoot
	}
	return uruncInit + guestBoot
}

func TestParallelBootSavesOverlappedTime(t *testing.T) {
	before := sequentialBoot(140*time.Millisecond, 140*time.Millisecond, 70*time.Millisecond)
	after := parallelBoot(140*time.Millisecond, 140*time.Millisecond, 70*time.Millisecond)
	if before != 350*time.Millisecond || after != 210*time.Millisecond {
		t.Fatalf("unexpected Firecracker model: before=%s after=%s", before, after)
	}
	if before-after != 140*time.Millisecond {
		t.Fatalf("expected to save shorter overlapped phase, saved %s", before-after)
	}

	before = sequentialBoot(220*time.Millisecond, 220*time.Millisecond, 160*time.Millisecond)
	after = parallelBoot(220*time.Millisecond, 220*time.Millisecond, 160*time.Millisecond)
	if before != 600*time.Millisecond || after != 380*time.Millisecond {
		t.Fatalf("unexpected QEMU model: before=%s after=%s", before, after)
	}
	if before-after != 220*time.Millisecond {
		t.Fatalf("expected to save shorter overlapped phase, saved %s", before-after)
	}
}

func BenchmarkSequentialFirecrackerSynthetic(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = sequentialBoot(140*time.Millisecond, 140*time.Millisecond, 70*time.Millisecond)
	}
}

func BenchmarkParallelFirecrackerSynthetic(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = parallelBoot(140*time.Millisecond, 140*time.Millisecond, 70*time.Millisecond)
	}
}

func BenchmarkSequentialQEMUSynthetic(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = sequentialBoot(220*time.Millisecond, 220*time.Millisecond, 160*time.Millisecond)
	}
}

func BenchmarkParallelQEMUSynthetic(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = parallelBoot(220*time.Millisecond, 220*time.Millisecond, 160*time.Millisecond)
	}
}
