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
    strokeColor: opts.color ?? opts.strokeColor ?? "#64748b",
    backgroundColor: "transparent",
    strokeStyle: opts.strokeStyle ?? "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
  });
}

function frame(id, x, y, w, h, fill, stroke, strokeWidth = 2) {
  return common(id, "rectangle", x, y, w, h, {
    backgroundColor: fill,
    strokeColor: stroke,
    strokeWidth,
  });
}

function dot(id, x, y, r = 8, color = "#111827") {
  return common(id, "ellipse", x - r, y - r, r * 2, r * 2, {
    backgroundColor: color,
    strokeColor: color,
    roughness: 0.6,
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
    ...title("Current exec-mode urunc lifecycle", "The VMM is the final exec step, so monitor startup cannot overlap with create/start setup."),
  ];

  els.push(text("left_title", 70, 165, 360, 42, "What blocks today", { fontSize: 28, color: "#374151" }));
  els.push(text("left_bullets", 90, 230, 360, 230,
    "- urunc uses exec mode\n- reexec waits for START\n- network/storage/hooks run first\n- VMM starts only at the end",
    { fontSize: 21, color: "#64748b" }));
  els.push(...rect("blocked_note", 75, 520, 350, 92, "No VMM API socket exists\nwhile setup is running", "#fee2e2", "#dc2626"));

  const lanes = [
    ["shim", "containerd-shim", 560, "#fef3c7", "#b45309"],
    ["create", "urunc create", 815, "#fee2e2", "#dc2626"],
    ["reexec", "urunc create\n--reexec", 1090, "#fee2e2", "#dc2626"],
    ["vm", "unikernel VM", 1370, "#dbeafe", "#1e40af"],
  ];
  const centers = {};
  for (const [id, label, x, fill, stroke] of lanes) {
    centers[id] = x + 92;
    els.push(...rect(`${id}_box`, x, 130, 184, 64, label, fill, stroke));
    els.push(line(`${id}_life`, centers[id], 210, centers[id], 820, { strokeColor: "#111827" }));
  }

  const msg = (id, y, from, to, label, color = "#111827") => {
    els.push(dot(`${id}_from`, centers[from], y));
    els.push(arrow(id, centers[from], y, centers[to], y, { color }));
    els.push(text(`${id}_label`, Math.min(centers[from], centers[to]) + 18, y - 28, Math.abs(centers[to] - centers[from]) - 36, 24, label, {
      fontSize: 16,
      color: "#374151",
      align: "center",
    }));
  };
  msg("m_create", 245, "shim", "create", "create");
  msg("m_reexec", 315, "create", "reexec", "setup terminal; exec in new netns");
  msg("m_booted", 395, "reexec", "create", 'IPC: "BOOTED"');
  els.push(...rect("save_pid", 600, 365, 160, 60, "save reexec\nPID", "#dcfce7", "#047857"));
  els.push(...rect("runtime_hooks", 875, 435, 180, 68, "execute\ncreateRuntime\nhooks", "#dcfce7", "#047857"));
  els.push(dot("create_dot_1", centers.create, 520));
  els.push(...rect("container_hooks", 610, 535, 190, 68, "execute\ncreateContainer\nhooks", "#dcfce7", "#047857"));
  els.push(arrow("container_hooks_arrow", 800, 570, centers.create, 570, { color: "#111827" }));
  msg("m_ok", 635, "create", "reexec", 'IPC: "OK"');
  msg("m_start", 730, "shim", "create", "start");
  msg("m_start_ipc", 785, "create", "reexec", 'IPC: "START"');
  els.push(...rect("setup_net", 1280, 505, 190, 60, "setup\ntap0_urunc", "#dcfce7", "#047857"));
  els.push(...rect("unmount", 985, 670, 190, 60, "unmount block\ndevice", "#dcfce7", "#047857"));
  els.push(...rect("start_hooks", 1275, 650, 220, 70, "execute\nstartContainer\nhooks", "#dcfce7", "#047857"));
  els.push(...rect("exec_vm", 1265, 805, 235, 78, "execve\nunikernel VM", "#dbeafe", "#1e40af"));
  els.push(line("late_bar", centers.reexec + 12, 400, centers.reexec + 12, 810, { strokeColor: "#dc2626", strokeWidth: 6 }));
  els.push(text("late_label", centers.reexec + 28, 430, 205, 64, "VMM launch is still\nbehind setup work", { fontSize: 17, color: "#dc2626" }));
  return els;
}

function diagram2() {
  const els = [
    ...title("Updated background-mode urunc lifecycle", "Use the time between create and start to spawn the VMM and configure it through the monitor API."),
  ];

  els.push(text("left_title", 65, 150, 390, 42, "Use create to start gap", { fontSize: 28, color: "#374151" }));
  els.push(text("left_bullets", 88, 220, 400, 320,
    "Create:\n  - start VMM process\n  - send available requests\n  - set up storage/network\n  - set remaining requests\n\nStart:\n  - run hooks\n  - start VM",
    { fontSize: 21, color: "#64748b" }));
  els.push(...rect("gain_note", 80, 595, 340, 82, "Background mode targets\n30-40 ms faster spawn time", "#dcfce7", "#047857"));

  const lanes = [
    ["shim", "containerd-shim", 560, "#fef3c7", "#b45309"],
    ["create", "urunc create", 820, "#fee2e2", "#dc2626"],
    ["reexec", "urunc create\n--reexec", 1085, "#fee2e2", "#dc2626"],
    ["api", "VMM process\n+ API socket", 1370, "#dbeafe", "#1e40af"],
  ];
  const centers = {};
  for (const [id, label, x, fill, stroke] of lanes) {
    centers[id] = x + 92;
    els.push(...rect(`${id}_box`, x, 130, 184, 64, label, fill, stroke));
    els.push(line(`${id}_life`, centers[id], 210, centers[id], 1130, { strokeColor: "#111827" }));
  }
  const msg = (id, y, from, to, label, color = "#111827") => {
    els.push(dot(`${id}_from`, centers[from], y));
    els.push(arrow(id, centers[from], y, centers[to], y, { color }));
    els.push(text(`${id}_label`, Math.min(centers[from], centers[to]) + 18, y - 28, Math.abs(centers[to] - centers[from]) - 36, 24, label, {
      fontSize: 16,
      color: "#374151",
      align: "center",
    }));
  };
  msg("m_create", 245, "shim", "create", "create");
  msg("m_reexec", 315, "create", "reexec", "setup terminal; exec in new netns");
  msg("m_booted", 390, "reexec", "create", 'IPC: "BOOTED"');
  els.push(...rect("start_vmm", 1385, 345, 180, 58, "start VMM", "#f3f4f6", "#6b7280"));
  els.push(arrow("reexec_to_start_vmm", centers.reexec, 365, 1385, 374, { color: "#111827" }));
  els.push(...rect("runtime_hooks", 890, 445, 190, 68, "execute\ncreateRuntime\nhooks", "#dcfce7", "#047857"));
  els.push(...rect("boot_source", 1390, 480, 220, 78, "set boot source\nand initrd", "#f3f4f6", "#6b7280"));
  els.push(...rect("net", 1390, 610, 220, 58, "set networking", "#f3f4f6", "#6b7280"));
  els.push(...rect("tap", 1115, 610, 215, 58, "setup\ntap0_urunc", "#dcfce7", "#047857"));
  els.push(...rect("storage", 1390, 735, 220, 58, "set storage", "#f3f4f6", "#6b7280"));
  els.push(...rect("unmount", 1115, 735, 215, 58, "unmount block\ndevice", "#dcfce7", "#047857"));
  msg("m_ok", 570, "create", "reexec", 'IPC: "OK"');
  msg("m_start", 825, "shim", "create", "start");
  msg("m_start_ipc", 875, "create", "reexec", 'IPC: "START"');
  els.push(...rect("start_hooks", 1115, 915, 230, 72, "execute\nstartContainer\nhooks", "#dcfce7", "#047857"));
  msg("m_start_guest", 1030, "reexec", "api", "StartGuest / start VM", "#1e40af");
  els.push(...rect("start_vm", 1390, 1065, 235, 70, "start VM", "#dbeafe", "#1e40af"));
  els.push(line("parallel_band", centers.api + 18, 345, centers.api + 18, 1060, { strokeColor: "#3b82f6", strokeWidth: 6 }));
  els.push(text("api_label", centers.api + 92, 420, 190, 84, "API requests land\nwhile runtime setup\ncontinues", { fontSize: 16, color: "#1e40af" }));
  return els;
}

function diagram3() {
  const els = [
    ...title("Who controls the VMM API?", "The maintainer notes this ownership choice is central to background-mode VMM management."),
  ];

  const cards = [
    ["a", 70, 170, 360, 470, "#dbeafe", "#1e40af", "A. containerd-side urunc", "Cleaner API owner\nLess IPC communication\n\nRisk:\nnetwork setup may be harder\nbecause the API caller is not\ninside the reexec namespace"],
    ["b", 500, 170, 360, 470, "#fef3c7", "#b45309", "B. reexec process", "Easier namespace access\nNetworking setup is local\n\nCost:\nreexec becomes a mediator\nand extra IPC remains"],
    ["c", 930, 170, 420, 470, "#dcfce7", "#047857", "C. hybrid control", "reexec sets up networking\ncontainerd-side urunc talks\ndirectly to the VMM API\n\nThis matches the slide deck's\n\"Both\" option and keeps HVT/SPT\non the old exec path"],
  ];

  for (const [id, x, y, w, h, fill, stroke, heading, body] of cards) {
    els.push(frame(`${id}_frame`, x, y, w, h, fill, stroke, 3));
    els.push(text(`${id}_heading`, x + 28, y + 34, w - 56, 34, heading, {
      fontSize: 22,
      color: stroke,
      align: "center",
    }));
    els.push(line(`${id}_rule`, x + 28, y + 86, x + w - 28, y + 86, { strokeColor: stroke, strokeWidth: 3 }));
    els.push(text(`${id}_body`, x + 36, y + 120, w - 72, 230, body, {
      fontSize: 17,
      color: "#374151",
    }));
  }

  els.push(...rect("a_urunc", 125, 525, 110, 48, "urunc", "#fed7aa", "#c2410c"));
  els.push(...rect("a_api", 295, 525, 110, 48, "VMM API", "#a7f3d0", "#047857"));
  els.push(arrow("a_arrow", 235, 549, 295, 549, { color: "#1e40af" }));

  els.push(...rect("b_reexec", 555, 525, 110, 48, "reexec", "#fee2e2", "#dc2626"));
  els.push(...rect("b_api", 725, 525, 110, 48, "VMM API", "#a7f3d0", "#047857"));
  els.push(arrow("b_arrow", 665, 549, 725, 549, { color: "#b45309" }));

  els.push(...rect("c_reexec", 965, 525, 112, 48, "reexec", "#fee2e2", "#dc2626"));
  els.push(...rect("c_urunc", 1105, 525, 112, 48, "urunc", "#fed7aa", "#c2410c"));
  els.push(...rect("c_api", 1228, 525, 112, 48, "VMM API", "#a7f3d0", "#047857"));
  els.push(arrow("c_net", 1021, 573, 1021, 610, { color: "#047857" }));
  els.push(text("c_net_label", 945, 612, 150, 28, "network setup", { fontSize: 14, color: "#047857", align: "center" }));
  els.push(arrow("c_api_arrow", 1217, 549, 1228, 549, { color: "#047857" }));

  els.push(...code("api_evidence", 220, 705, 930, 128, `Monitor APIs are JSON over Unix sockets:\nQEMU monitor:      QMP over unix socket\nFirecracker API:   HTTP/JSON over unix socket\nDecision point:    who owns the socket client and process lifecycle?`));
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
