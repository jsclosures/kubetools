const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.AppsV1Api);

/**
 * Performs a rolling restart of a Deployment, equivalent to
 * `kubectl rollout restart deployment <name>`.
 *
 * Like kubectl, this stamps a `kubectl.kubernetes.io/restartedAt` annotation on
 * the pod template with the current timestamp. Changing the template triggers a
 * new rollout, restarting the pods one batch at a time per the Deployment's
 * rolling-update strategy. A strategic-merge patch is used so the annotation is
 * merged in without disturbing any existing template annotations.
 */
async function rolloutRestart(ctx) {
    const namespace = ctx.namespace;
    const deploymentname = String(ctx.deploymentname || "").trim();

    if (!deploymentname) {
        console.error('Missing deploymentname: pass deploymentname=<name> (see --help).');
        process.exitCode = 1;
        return;
    }

    const restartedAt = new Date().toISOString();
    const patch = {
        spec: {
            template: {
                metadata: {
                    annotations: {
                        "kubectl.kubernetes.io/restartedAt": restartedAt
                    }
                }
            }
        }
    };

    try {
        console.log(`Restarting deployment ${deploymentname} in namespace ${namespace} (restartedAt=${restartedAt})...`);
        await k8sApi.patchNamespacedDeployment(
            { name: deploymentname, namespace, body: patch },
            k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.StrategicMergePatch)
        );
        console.log(`Successfully triggered a rolling restart of deployment ${deploymentname}.`);
    } catch (err) {
        console.error('Error restarting deployment:', err.body || err);
        process.exitCode = 1;
    }
}

const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.deploymentname = "";

const { init } = require("./lib");

const USAGE = {
    "name": "rolloutrestart.js",
    "description": "Rolling-restart a Deployment (equivalent to 'kubectl rollout restart deployment').",
    "context": CONTEXT,
    "options": {
        "namespace": "Deployment namespace.",
        "deploymentname": "Deployment to restart (required)."
    },
    "examples": [
        "node src/rolloutrestart.js deploymentname=my-deploy",
        "node src/rolloutrestart.js namespace=production deploymentname=my-api"
    ]
};

init(USAGE);

rolloutRestart(CONTEXT);
