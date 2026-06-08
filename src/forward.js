const net = require("net");
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const core = kc.makeApiClient(k8s.CoreV1Api);

// Parse a strict TCP port (1-65535). Rejects empty, non-numeric, partially
// numeric ("80foo"), and out-of-range values by throwing.
function parsePort(value, label) {
    const s = String(value).trim();
    if (!/^\d+$/.test(s)) {
        throw new Error(`Invalid ${label}: ${value} (must be a number 1-65535).`);
    }
    const n = parseInt(s, 10);
    if (n < 1 || n > 65535) {
        throw new Error(`Invalid ${label}: ${value} (must be between 1 and 65535).`);
    }
    return n;
}

/**
 * Resolve which pod and remote (pod container) port to forward to.
 *
 * Like `kubectl port-forward`, this supports two modes:
 *   - podname=<pod>        forward straight to a pod (targetport required)
 *   - servicename=<svc>    resolve the Service's selector to a backing pod and
 *                          derive the pod port from the Service's targetPort
 *                          (a numeric targetport= override always wins)
 */
async function resolveTarget(ctx) {
    const namespace = ctx.namespace;

    // Direct pod forwarding.
    if (ctx.podname) {
        if (!ctx.targetport) {
            throw new Error("targetport=<port> is required when forwarding to a podname.");
        }
        return { pod: ctx.podname, remotePort: parsePort(ctx.targetport, "targetport") };
    }

    if (!ctx.servicename) {
        throw new Error("Provide servicename=<service> (or podname=<pod>). See --help.");
    }

    // Resolve the Service to its selector and ports.
    const svc = await core.readNamespacedService({ name: ctx.servicename, namespace });
    const selector = svc.spec && svc.spec.selector;
    if (!selector || Object.keys(selector).length === 0) {
        throw new Error(`Service ${ctx.servicename} has no selector; cannot resolve backing pods (specify podname instead).`);
    }

    // Find a pod backing the Service via its label selector.
    const labelSelector = Object.keys(selector).map((k) => `${k}=${selector[k]}`).join(",");
    const podList = await core.listNamespacedPod({ namespace, labelSelector });
    const pods = (podList && podList.items) || [];
    if (pods.length === 0) {
        throw new Error(`No pods found for service ${ctx.servicename} (selector ${labelSelector}).`);
    }
    const chosen = pods.find((p) => p.status && p.status.phase === "Running") || pods[0];
    const pod = chosen.metadata.name;

    // Determine the remote pod port.
    let remotePort;
    if (ctx.targetport) {
        return { pod, remotePort: parsePort(ctx.targetport, "targetport") };
    }

    const ports = (svc.spec && svc.spec.ports) || [];
    if (ports.length === 0) {
        throw new Error(`Service ${ctx.servicename} exposes no ports; specify targetport.`);
    }
    let sp = ports[0];
    if (ctx.serviceport) {
        sp = ports.find((p) => String(p.port) === String(ctx.serviceport));
        if (!sp) {
            const available = ports.map((p) => p.port).join(", ");
            throw new Error(`Service ${ctx.servicename} has no port ${ctx.serviceport} (available: ${available}).`);
        }
    }

    const tp = sp.targetPort;
    if (typeof tp === "number") {
        remotePort = tp;
    } else if (/^\d+$/.test(String(tp))) {
        remotePort = parseInt(String(tp), 10);
    } else if (tp) {
        // Named targetPort: resolve it against the chosen pod's container ports.
        const name = String(tp);
        const containers = (chosen.spec && chosen.spec.containers) || [];
        for (const c of containers) {
            const found = (c.ports || []).find((cp) => cp.name === name);
            if (found) {
                remotePort = found.containerPort;
                break;
            }
        }
        if (remotePort === undefined) {
            throw new Error(`Could not resolve named targetPort '${name}' on pod ${pod}; specify targetport explicitly.`);
        }
    } else {
        // No targetPort set on the Service means it defaults to the service port.
        remotePort = sp.port;
    }

    if (remotePort === undefined || Number.isNaN(remotePort)) {
        throw new Error("Could not determine remote target port; specify targetport.");
    }
    return { pod, remotePort };
}

async function startForward(ctx) {
    const namespace = ctx.namespace;

    let target;
    try {
        target = await resolveTarget(ctx);
    } catch (err) {
        console.error("Error resolving forward target:", err.body || err.message || err);
        process.exitCode = 1;
        return;
    }

    const { pod, remotePort } = target;
    let localPort;
    try {
        localPort = ctx.localport ? parsePort(ctx.localport, "localport") : remotePort;
    } catch (err) {
        console.error(err.message || err);
        process.exitCode = 1;
        return;
    }

    const forward = new k8s.PortForward(kc);

    const server = net.createServer((socket) => {
        forward.portForward(namespace, pod, [remotePort], socket, null, socket).catch((err) => {
            console.error("Port-forward connection error:", err.message || err);
            socket.destroy();
        });
    });

    server.on("error", (err) => {
        console.error("Local server error:", err.message || err);
        process.exitCode = 1;
    });

    server.listen(localPort, "127.0.0.1", () => {
        const via = ctx.podname ? `pod ${pod}` : `service ${ctx.servicename} (pod ${pod})`;
        console.log(`Forwarding 127.0.0.1:${localPort} -> ${via}:${remotePort} in namespace ${namespace}.`);
        console.log("Press Ctrl+C to stop.");
    });

    const shutdown = () => {
        console.log("\nStopping port-forward...");
        server.close(() => process.exit(0));
        // Force-exit if connections keep the server open.
        setTimeout(() => process.exit(0), 1000).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.servicename = "";
CONTEXT.podname = "";
CONTEXT.serviceport = "";
CONTEXT.targetport = "";
CONTEXT.localport = "";

const { init } = require("./lib");

const USAGE = {
    "name": "forward.js",
    "description": "Port-forward a local port to a Service (resolved to a backing pod) or directly to a pod (like 'kubectl port-forward').",
    "context": CONTEXT,
    "options": {
        "namespace": "Namespace of the service/pod.",
        "servicename": "Service to forward to (resolved to a backing pod).",
        "podname": "Pod to forward to directly (takes precedence over servicename; requires targetport).",
        "serviceport": "Which service port to use when the service exposes several (defaults to the first).",
        "targetport": "Remote pod container port to forward to (overrides service resolution; required with podname).",
        "localport": "Local port to listen on (defaults to the resolved remote port)."
    },
    "examples": [
        "node src/forward.js servicename=my-svc",
        "node src/forward.js servicename=my-svc localport=8080",
        "node src/forward.js servicename=my-svc serviceport=443 localport=8443",
        "node src/forward.js podname=my-pod-0 targetport=8080 localport=8080"
    ]
};

init(USAGE);

startForward(CONTEXT);
