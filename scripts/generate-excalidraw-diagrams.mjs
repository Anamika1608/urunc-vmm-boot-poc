import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("diagrams/excalidraw");
fs.mkdirSync(outDir, { recursive: true });

let seed = 1000;

function base(elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
    files: {},
  };
}

function common(id, type, x, y, width, height, extra = {}) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: extra.strokeColor ?? "#1e3a5f",
    backgroundColor: extra.backgroundColor ?? "transparent",
    fillStyle: "solid",
    strokeWidth: extra.strokeWidth ?? 2,
    strokeStyle: extra.strokeStyle ?? "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: seed++,
    version: 1,
    versionNonce: seed++,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...extra,
  };
}

function rect(id, x, y, w, h, label, fill = "#dbeafe", stroke = "#1e3a5f") {
  const lines = String(label).split("\n").length;
  const labelHeight = Math.max(28, lines * 24);
  return [
    common(id, "rectangle", x, y, w, h, {
      backgroundColor: fill,
      strokeColor: stroke,
    }),
    text(`${id}_text`, x + 12, y + (h - labelHeight) / 2, w - 24, labelHeight, label, {
      fontSize: 17,
      color: "#374151",
      align: "center",
    }),
  ];
}

function text(id, x, y, w, h, value, opts = {}) {
  return common(id, "text", x, y, w, h, {
    strokeColor: opts.color ?? "#64748b",
    backgroundColor: "transparent",
    strokeWidth: 1,
    text: value,
    fontSize: opts.fontSize ?? 18,
    fontFamily: 1,
    textAlign: opts.align ?? "left",
    verticalAlign: "top",
    containerId: null,
    originalText: value,
    lineHeight: 1.25,
  });
}

function code(id, x, y, w, h, value) {
  return [
    common(id, "rectangle", x, y, w, h, {
      backgroundColor: "#1e293b",
      strokeColor: "#0f172a",
    }),
    text(`${id}_text`, x + 14, y + 12, w - 28, h - 24, value, {
      fontSize: 15,
      color: "#22c55e",
    }),
  ];
}

function arrow(id, x1, y1, x2, y2, opts = {}) {
  return common(id, "arrow", x1, y1, x2 - x1, y2 - y1, {
    strokeColor: opts.color ?? "#1e3a5f",
    backgroundColor: "transparent",
    roundness: { type: 2 },
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead ?? "arrow",
  });
}

function line(id, x1, y1, x2, y2, opts = {}) {
  return common(id, "line", x1, y1, x2 - x1, y2 - y1, {
    strokeColor: opts.color ?? "#64748b",
    backgroundColor: "transparent",
    strokeStyle: opts.strokeStyle ?? "solid",
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
  });
}

function title(value, subtitle) {
  return [
    text("title", 50, 35, 1160, 44, value, { fontSize: 30, color: "#1e40af" }),
    text("subtitle", 52, 82, 1180, 34, subtitle, { fontSize: 17, color: "#64748b" }),
  ];
}

function write(name, elements) {
  fs.writeFileSync(path.join(outDir, `${name}.excalidraw`), JSON.stringify(base(elements), null, 2));
}

function diagram1() {
  const els = [
    ...title("Current sequential VMM boot flow", "The monitor is the last opaque execve step, so VMM startup cannot overlap with urunc setup."),
  ];
  const actors = [
    ["cli", "urunc CLI", 90, 150],
    ["reexec", "reexec process", 340, 150],
    ["setup", "network/rootfs/hooks", 600, 190],
    ["vmm", "VMM process", 900, 150],
    ["guest", "guest", 1130, 150],
  ];
  for (const [id, label, x, w] of actors) {
    const center = x + w / 2;
    els.push(...rect(`${id}_actor`, x, 140, w, 52, label, "#dbeafe"));
    els.push(line(`${id}_life`, center, 205, center, 760, { strokeStyle: "dashed" }));
  }
  const msgs = [
    [210, 165, 415, "start reexec"],
    [280, 415, 165, "created state"],
    [355, 165, 415, "UC_START"],
    [430, 415, 695, "setup net/rootfs/hooks"],
    [505, 415, 695, "BuildExecCmd"],
    [580, 415, 165, "RX_SUCCESS"],
    [655, 415, 975, "syscall.Exec(vmm.Path(), args, env)"],
    [720, 975, 1205, "guest boot begins"],
  ];
  for (const [y, x1, x2, label] of msgs) {
    els.push(arrow(`msg_${y}`, x1, y, x2, y));
    els.push(text(`msg_${y}_label`, Math.min(x1, x2) + 18, y - 28, Math.abs(x2 - x1) - 28, 24, label, {
      fontSize: 15,
      color: "#374151",
      align: "center",
    }));
  }
  els.push(...code("evidence", 720, 250, 470, 130, `Firecracker: --no-api --config-file /tmp/fc.json\nQEMU:       -monitor null\nFinal step: syscall.Exec(...)`));
  els.push(...rect("dead_time", 745, 450, 390, 64, "No socket control before guest launch", "#fee2e2", "#dc2626"));
  return els;
}

function diagram2() {
  const els = [
    ...title("Proposed parallel VMM boot flow", "Start the monitor early, wait for its control socket, and release the guest only after OCI start."),
  ];
  const lanes = [
    ["create", "urunc create", 90, "#fed7aa", "#c2410c"],
    ["vmm", "StartVMM and socket open", 330, "#60a5fa", "#1e3a5f"],
    ["setup", "network/rootfs/hooks", 330, "#93c5fd", "#1e3a5f"],
    ["start", "urunc start", 790, "#fed7aa", "#c2410c"],
    ["guest", "guest boot", 1040, "#a7f3d0", "#047857"],
  ];
  els.push(...rect("create_box", 70, 180, 230, 76, "create\nstate: created", "#fed7aa", "#c2410c"));
  els.push(...rect("vmm_bar", 380, 165, 360, 58, "go StartVMM()", "#60a5fa"));
  els.push(...rect("setup_bar", 380, 265, 360, 58, "setup network, rootfs, hooks", "#93c5fd"));
  els.push(...rect("socket_ready", 770, 165, 170, 58, "socket ready", "#a7f3d0", "#047857"));
  els.push(...rect("start_box", 780, 365, 240, 86, "Configure\nStartGuest", "#fed7aa", "#c2410c"));
  els.push(...rect("guest_box", 1100, 365, 180, 70, "guest boots", "#a7f3d0", "#047857"));
  els.push(arrow("create_to_vmm", 300, 205, 380, 195));
  els.push(arrow("create_to_setup", 300, 224, 380, 292));
  els.push(arrow("vmm_to_ready", 740, 195, 770, 195));
  els.push(arrow("setup_to_start", 740, 292, 770, 398));
  els.push(arrow("ready_to_start", 855, 223, 855, 365));
  els.push(arrow("start_to_guest", 1020, 400, 1100, 400));
  els.push(...rect("parallel_note", 360, 345, 365, 78, "Critical path saves overlapped\nVMM startup and urunc setup", "#dcfce7", "#047857"));
  els.push(...code("state_evidence", 80, 500, 1080, 140, `create: monitor may be spawned or paused, but OCI state remains created\nstart: WaitForSocket -> Configure -> StartGuest -> mark running\nfailure: timeout or monitor exit prevents transition to running`));
  return els;
}

function diagram3() {
  const els = [
    ...title("VMM interface split", "Socket-capable monitors opt into split boot. Legacy monitors keep the old exec path."),
  ];
  els.push(...rect("vmm_iface", 480, 150, 330, 145, "VMM\nBuildExecCmd\nPreExec\nStop / Signal / Path", "#dbeafe"));
  els.push(...rect("socket_iface", 150, 370, 360, 190, "SocketBootVMM\nStartVMM(ctx,args)\nWaitForSocket(timeout)\nConfigure(ctx,args)\nStartGuest(ctx)", "#a7f3d0", "#047857"));
  els.push(...rect("legacy_iface", 790, 370, 330, 170, "Legacy VMM\nHVT / SPT\nold exec path", "#fee2e2", "#dc2626"));
  els.push(...rect("fc_impl", 90, 670, 250, 85, "Firecracker\nHTTP over Unix socket", "#60a5fa"));
  els.push(...rect("qemu_impl", 430, 670, 250, 85, "QEMU\nQMP JSON socket", "#60a5fa"));
  els.push(arrow("vmm_to_socket", 540, 295, 360, 370));
  els.push(arrow("vmm_to_legacy", 755, 295, 955, 370));
  els.push(arrow("socket_to_fc", 270, 560, 215, 670));
  els.push(arrow("socket_to_qemu", 420, 560, 555, 670));
  els.push(...code("go_evidence", 705, 645, 430, 145, `type SocketBootVMM interface {\n  StartVMM(ctx, args) error\n  WaitForSocket(timeout) error\n  Configure(ctx, args) error\n  StartGuest(ctx) error\n}`));
  return els;
}

function diagram4() {
  const els = [
    ...title("Firecracker socket-first boot", "All device and boot configuration is sent before the final InstanceStart action."),
  ];
  const xs = [110, 480, 850];
  const labels = ["urunc", "Firecracker API socket", "microVM"];
  labels.forEach((label, i) => {
    els.push(...rect(`fc_actor_${i}`, xs[i], 140, 210, 52, label, i === 2 ? "#a7f3d0" : "#dbeafe", i === 2 ? "#047857" : "#1e3a5f"));
    els.push(line(`fc_life_${i}`, xs[i] + 105, 205, xs[i] + 105, 740, { strokeStyle: "dashed" }));
  });
  const calls = [
    [250, "PUT /machine-config", 215, 585],
    [325, "PUT /boot-source", 215, 585],
    [400, "PUT /drives/rootfs", 215, 585],
    [475, "PUT /network-interfaces/net1", 215, 585],
    [550, "PUT /actions { InstanceStart }", 215, 585],
    [625, "guest boot", 585, 955],
  ];
  for (const [y, label, x1, x2] of calls) {
    els.push(arrow(`fc_call_${y}`, x1, y, x2, y));
    els.push(text(`fc_call_${y}_label`, x1 + 20, y - 28, x2 - x1 - 40, 24, label, {
      fontSize: 16,
      color: y === 550 ? "#047857" : "#374151",
      align: "center",
    }));
  }
  els.push(...code("fc_json", 705, 245, 420, 185, `HTTP over Unix socket\n\nPUT /actions\n{\n  "action_type": "InstanceStart"\n}`));
  els.push(...rect("fc_guard", 700, 470, 430, 84, "StartGuest is the only point where\nthe guest begins execution", "#a7f3d0", "#047857"));
  return els;
}

function diagram5() {
  const els = [
    ...title("QEMU QMP paused boot", "QEMU starts with the guest CPU stopped. QMP cont releases execution after urunc setup."),
  ];
  const xs = [130, 520, 920];
  const labels = ["urunc", "QEMU QMP socket", "guest CPU"];
  labels.forEach((label, i) => {
    els.push(...rect(`qmp_actor_${i}`, xs[i], 140, 210, 52, label, i === 2 ? "#a7f3d0" : "#dbeafe", i === 2 ? "#047857" : "#1e3a5f"));
    els.push(line(`qmp_life_${i}`, xs[i] + 105, 205, xs[i] + 105, 740, { strokeStyle: "dashed" }));
  });
  const calls = [
    [245, "qemu -S -qmp unix:...", 235, 625],
    [330, "QMP greeting", 625, 235],
    [420, "{ execute: qmp_capabilities }", 235, 625],
    [500, "{ return: {} }", 625, 235],
    [585, "{ execute: cont }", 235, 625],
    [665, "CPU released, guest boots", 625, 1025],
  ];
  for (const [y, label, x1, x2] of calls) {
    els.push(arrow(`qmp_call_${y}`, x1, y, x2, y));
    els.push(text(`qmp_call_${y}_label`, Math.min(x1, x2) + 20, y - 28, Math.abs(x2 - x1) - 40, 24, label, {
      fontSize: 16,
      color: y >= 585 ? "#047857" : "#374151",
      align: "center",
    }));
  }
  els.push(...code("qmp_json", 735, 280, 380, 170, `QMP handshake\n\n{ "execute": "qmp_capabilities" }\n{ "execute": "cont" }`));
  els.push(...rect("qmp_guard", 735, 485, 380, 74, "-S keeps the guest paused until StartGuest", "#fef3c7", "#b45309"));
  return els;
}

write("01-current-sequential-boot", diagram1());
write("02-proposed-parallel-boot", diagram2());
write("03-vmm-interface-hierarchy", diagram3());
write("04-firecracker-api-sequence", diagram4());
write("05-qemu-qmp-sequence", diagram5());
