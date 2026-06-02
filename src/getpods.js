const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


/**
 * Scales a Kubernetes Deployment to a specified number of replicas.
 */
async function getPods(ctx) {
	let namespace = ctx.namespace;

    console.log(`Attempting to get pods in namesapce ${namespace}`);

    try {
        const res = await k8sApi.listNamespacedPod(
		{namespace}
        );
        let resStr = "failed";
	if( ctx.mode == 'default'){
		resStr = "";
		//res.items.forEach((item) => resStr += item.metadata.labels["statefulset.kubernetes.io/pod-name"] ? item.metadata.labels["statefulset.kubernetes.io/pod-name"] + "\n" : item.metadata.generateName + "\n");
		res.items.forEach((item) => resStr += item.metadata.name + "\n");
	}
	else {
	    resStr = JSON.stringify(res,null,5);
	}
        console.log(`${resStr}`);
    } catch (err) {
        console.error('Error getting pods:', err.body || err);
    }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.mode = "default";

const { init } = require("./lib");

const USAGE = {
        "name": "getpods.js",
        "description": "List pods in a namespace.",
        "context": CONTEXT,
        "options": {
            "namespace": "Namespace to query.",
            "mode": "\"default\" prints names; anything else prints full JSON."
        },
        "examples": [
            "node src/getpods.js namespace=ns-dev",
            "node src/getpods.js namespace=ns-dev mode=json"
        ]
    };

init(USAGE);

// Run the function
getPods(CONTEXT);

