const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

function sumResource(containers, section, resource) {
    return (containers || []).reduce((total, container) => {
        const value = container.resources && container.resources[section]
            ? container.resources[section][resource]
            : undefined;
        return total + parseQuantity(value, resource);
    }, 0);
}

function parseQuantity(value, resource) {
    if (!value) return 0;
    const match = String(value).match(/^([+-]?(?:\d+\.?\d*|\.\d+))([a-zA-Z]*)$/);
    if (!match) return 0;

    const amount = Number(match[1]);
    const suffix = match[2];
    if (resource === "cpu") {
        const cpuMultipliers = { n: 0.000001, u: 0.001, m: 1, "": 1000 };
        return amount * (cpuMultipliers[suffix] ?? 0);
    }

    const memoryMultipliers = {
        "": 1 / (1024 * 1024),
        K: 1000 / (1024 * 1024),
        Ki: 1 / 1024,
        M: 1000 ** 2 / (1024 ** 2),
        Mi: 1,
        G: 1000 ** 3 / (1024 ** 2),
        Gi: 1024,
        T: 1000 ** 4 / (1024 ** 2),
        Ti: 1024 ** 2
    };
    return amount * (memoryMultipliers[suffix] ?? 0);
}

function getPodUsage(metric) {
    return (metric && metric.containers || []).reduce((usage, container) => {
        usage.cpuMillicores += parseQuantity(container.usage && container.usage.cpu, "cpu");
        usage.memoryMiB += parseQuantity(container.usage && container.usage.memory, "memory");
        return usage;
    }, { cpuMillicores: 0, memoryMiB: 0 });
}

function formatNumber(value) {
    return Math.round(value).toLocaleString("en-US");
}

function printTable(rows) {
    const headers = ["NAMESPACE", "POD", "STATUS", "CPU", "MEMORY", "CPU REQ/LIMIT", "MEM REQ/LIMIT"];
    const values = rows.map(row => [
        row.namespace,
        row.name,
        row.status,
        row.metricsAvailable ? `${formatNumber(row.usage.cpuMillicores)}m` : "n/a",
        row.metricsAvailable ? `${formatNumber(row.usage.memoryMiB)}Mi` : "n/a",
        `${formatNumber(row.requests.cpuMillicores)}m/${formatNumber(row.limits.cpuMillicores)}m`,
        `${formatNumber(row.requests.memoryMiB)}Mi/${formatNumber(row.limits.memoryMiB)}Mi`
    ]);
    const widths = headers.map((header, index) =>
        Math.max(header.length, ...values.map(row => String(row[index]).length))
    );
    const render = row => row.map((value, index) => String(value).padEnd(widths[index])).join("  ");
    console.log(render(headers));
    console.log(render(widths.map(width => "-".repeat(width))));
    values.forEach(row => console.log(render(row)));
}

async function describeNodes(ctx) {
    console.log("Attempting to describe cluster nodes and pod resource consumption");

    try {
        const [nodeList, podList] = await Promise.all([
            coreApi.listNode(),
            coreApi.listPodForAllNamespaces()
        ]);

        let metricItems = [];
        let metricsError = null;
        try {
            const metrics = await customApi.listClusterCustomObject({
                group: "metrics.k8s.io",
                version: "v1beta1",
                plural: "pods"
            });
            metricItems = metrics.items || [];
        } catch (err) {
            metricsError = err.body || err.message || err;
        }

        const metricsByPod = new Map(metricItems.map(metric => [
            `${metric.metadata.namespace}/${metric.metadata.name}`,
            metric
        ]));
        const selectedNodes = ctx.nodename
            ? nodeList.items.filter(node => node.metadata.name === ctx.nodename)
            : nodeList.items;

        if (ctx.nodename && selectedNodes.length === 0) {
            console.error(`Node not found: ${ctx.nodename}`);
            return;
        }

        const report = selectedNodes.map(node => {
            const pods = podList.items
                .filter(pod => pod.spec.nodeName === node.metadata.name)
                .map(pod => {
                    const metric = metricsByPod.get(`${pod.metadata.namespace}/${pod.metadata.name}`);
                    return {
                        namespace: pod.metadata.namespace,
                        name: pod.metadata.name,
                        status: pod.status.phase,
                        metricsAvailable: Boolean(metric),
                        usage: getPodUsage(metric),
                        requests: {
                            cpuMillicores: sumResource(pod.spec.containers, "requests", "cpu"),
                            memoryMiB: sumResource(pod.spec.containers, "requests", "memory")
                        },
                        limits: {
                            cpuMillicores: sumResource(pod.spec.containers, "limits", "cpu"),
                            memoryMiB: sumResource(pod.spec.containers, "limits", "memory")
                        }
                    };
                });
            return {
                name: node.metadata.name,
                status: (node.status.conditions || []).some(
                    condition => condition.type === "Ready" && condition.status === "True"
                ) ? "Ready" : "NotReady",
                pods
            };
        });

        if (ctx.mode !== "default") {
            console.log(JSON.stringify({ metricsAvailable: !metricsError, nodes: report }, null, 5));
            return;
        }

        if (metricsError) {
            console.error("Warning: pod usage is unavailable from metrics.k8s.io. Ensure Metrics Server is installed and accessible.");
        }
        report.forEach(node => {
            console.log(`\nNode: ${node.name} (${node.status}) - ${node.pods.length} pod(s)`);
            if (node.pods.length) {
                printTable(node.pods);
            } else {
                console.log("No pods scheduled.");
            }
        });
    } catch (err) {
        console.error("Error describing nodes:", err.body || err);
    }
}

const CONTEXT = {};
CONTEXT.nodename = "";
CONTEXT.mode = "default";

const { init } = require("./lib");

const USAGE = {
    name: "describenodes.js",
    description: "List nodes, their scheduled pods, and pod CPU/memory consumption.",
    context: CONTEXT,
    options: {
        nodename: "Optional node name; empty lists every node.",
        mode: "\"default\" prints tables; anything else prints full report JSON."
    },
    examples: [
        "node src/describenodes.js",
        "node src/describenodes.js nodename=worker-1",
        "node src/describenodes.js mode=json"
    ]
};

init(USAGE);
describeNodes(CONTEXT);
