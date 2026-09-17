const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

/**
 * Lists the nodes in the Kubernetes cluster.
 */
async function getNodes(ctx) {
    console.log("Attempting to get cluster nodes");

    try {
        const res = await k8sApi.listNode();
        let resStr = "failed";
        if (ctx.mode == "default") {
            resStr = "";
            res.items.forEach((item) => resStr += item.metadata.name + "\n");
        } else {
            resStr = JSON.stringify(res, null, 5);
        }
        console.log(`${resStr}`);
    } catch (err) {
        console.error("Error getting nodes:", err.body || err);
    }
}

const CONTEXT = {};
CONTEXT.mode = "default";

const { init } = require("./lib");

const USAGE = {
    "name": "getnodes.js",
    "description": "List all nodes in the cluster.",
    "context": CONTEXT,
    "options": {
        "mode": "\"default\" prints names; anything else prints full JSON."
    },
    "examples": [
        "node src/getnodes.js",
        "node src/getnodes.js mode=json"
    ]
};

init(USAGE);

getNodes(CONTEXT);
