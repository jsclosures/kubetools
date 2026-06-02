const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.AutoscalingV2Api);
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.hpaName = "";
// Min/max replicas and target CPU utilization are all opt-in: leave empty to keep
// the HPA's existing value and only patch the fields you actually pass.
CONTEXT.minReplicas = "";
CONTEXT.maxReplicas = "";
CONTEXT.targetCPUUtilization = "";

const { init } = require("./lib");

const USAGE = {
        "name": "edithpa.js",
        "description": "Patch a HorizontalPodAutoscaler: min/max replicas and (optionally) the target CPU utilization.",
        "context": CONTEXT,
        "options": {
            "namespace": "HPA namespace.",
            "hpaName": "HPA name to patch.",
            "minReplicas": "Minimum replicas (non-negative integer); empty leaves it unchanged.",
            "maxReplicas": "Maximum replicas (positive integer); empty leaves it unchanged.",
            "targetCPUUtilization": "Target average CPU utilization percent (1-100); empty leaves it unchanged."
        },
        "examples": [
            "node src/edithpa.js hpaName=my-hpa minReplicas=2 maxReplicas=6 targetCPUUtilization=70",
            "node src/edithpa.js hpaName=my-hpa maxReplicas=10",
            "node src/edithpa.js hpaName=my-hpa targetCPUUtilization=80"
        ]
    };

init(USAGE);

async function editHpa() {
    // Build the JSON Patch incrementally — only include the fields the caller passed,
    // so we never overwrite the HPA's existing min/max replicas with a default.
    const patch = [];

    // Optionally set the minimum replicas.
    let min;
    if( CONTEXT.minReplicas ){
            if( !/^\d+$/.test(String(CONTEXT.minReplicas).trim()) ){
                    console.error(`Invalid minReplicas "${CONTEXT.minReplicas}": expected a non-negative integer.`);
                    process.exitCode = 1;
                    return;
            }
            min = parseInt(CONTEXT.minReplicas, 10);
            // Use "add": minReplicas may be absent on an HPA, where JSON Patch "replace"
            // would fail. "add" sets it whether or not it already exists.
            patch.push({ "op": "add", "path": "/spec/minReplicas", "value": min });
    }

    // Optionally set the maximum replicas.
    let max;
    if( CONTEXT.maxReplicas ){
            if( !/^\d+$/.test(String(CONTEXT.maxReplicas).trim()) ){
                    console.error(`Invalid maxReplicas "${CONTEXT.maxReplicas}": expected a positive integer.`);
                    process.exitCode = 1;
                    return;
            }
            max = parseInt(CONTEXT.maxReplicas, 10);
            if( max < 1 ){
                    console.error(`Invalid maxReplicas "${CONTEXT.maxReplicas}": expected a positive integer.`);
                    process.exitCode = 1;
                    return;
            }
            patch.push({ "op": "replace", "path": "/spec/maxReplicas", "value": max });
    }

    // When both are provided, catch an inverted range early with a clear message
    // instead of relying on the API to reject it.
    if( min !== undefined && max !== undefined && min > max ){
            console.error(`Invalid range: minReplicas (${min}) must not exceed maxReplicas (${max}).`);
            process.exitCode = 1;
            return;
    }

    // Optionally set the target average CPU utilization for the HPA.
    if( CONTEXT.targetCPUUtilization ){
            if( !/^\d+$/.test(String(CONTEXT.targetCPUUtilization).trim()) ){
                    console.error(`Invalid targetCPUUtilization "${CONTEXT.targetCPUUtilization}": expected an integer percentage between 1 and 100.`);
                    process.exitCode = 1;
                    return;
            }
            const target = parseInt(CONTEXT.targetCPUUtilization, 10);
            if( target < 1 || target > 100 ){
                    console.error(`Invalid targetCPUUtilization "${CONTEXT.targetCPUUtilization}": expected an integer percentage between 1 and 100.`);
                    process.exitCode = 1;
                    return;
            }

            // Read the current HPA so we only touch the CPU metric and preserve any others.
            const current = await k8sApi.readNamespacedHorizontalPodAutoscaler({
                    name: CONTEXT.hpaName,
                    namespace: CONTEXT.namespace
            });
            const metrics = (current.spec && current.spec.metrics) || [];
            const cpuIndex = metrics.findIndex(
                    (m) => m.type === "Resource" && m.resource && m.resource.name === "cpu"
            );
            const cpuMetric = {
                    "type": "Resource",
                    "resource": {
                            "name": "cpu",
                            "target": {
                                    "type": "Utilization",
                                    "averageUtilization": target
                            }
                    }
            };

            if( cpuIndex >= 0 ){
                    // Replace only the existing CPU metric's target, leaving other metrics intact.
                    patch.push({
                            "op": "replace",
                            "path": `/spec/metrics/${cpuIndex}/resource/target`,
                            "value": cpuMetric.resource.target
                    });
            } else if( metrics.length > 0 ){
                    // Append a CPU metric without disturbing existing metrics.
                    patch.push({
                            "op": "add",
                            "path": "/spec/metrics/-",
                            "value": cpuMetric
                    });
            } else {
                    // No metrics array present yet — create it with the CPU metric.
                    patch.push({
                            "op": "add",
                            "path": "/spec/metrics",
                            "value": [cpuMetric]
                    });
            }
    }

    if( patch.length === 0 ){
            console.error('Nothing to patch: pass at least one of minReplicas, maxReplicas, or targetCPUUtilization.');
            process.exitCode = 1;
            return;
    }

    // Use 'application/json-patch+json' for RFC 6902 JSON Patch
    try {
            await k8sApi.patchNamespacedHorizontalPodAutoscaler(
                    { name: CONTEXT.hpaName,
                      namespace: CONTEXT.namespace,
                      body: patch},
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                { headers: { "Content-Type": "application/json-patch+json" } }
            );
            console.log('HPA patched successfully');
    } catch (err) {
            console.error('Error patching HPA:', err.body || err);
            process.exitCode = 1;
    }
}

editHpa();

