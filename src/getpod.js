const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


/**
 * Scales a Kubernetes Deployment to a specified number of replicas.
 */
async function getPods(ctx) {
	let namespace = ctx.namespace;
	let podname = ctx.podname;

    console.log(`Attempting to get pods in namesapce ${namespace}`);

    try {
        const res = await k8sApi.readNamespacedPod(
		{namespace,name: podname}
        );
        let resStr = "failed";
	if( ctx.mode == 'default'){
		resStr = "";
		//res.items.forEach((item) => resStr += item.metadata.labels["statefulset.kubernetes.io/pod-name"] ? item.metadata.labels["statefulset.kubernetes.io/pod-name"] + "\n" : item.metadata.generateName + "\n");
		resStr += res.metadata.name + "\n";
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
CONTEXT.mode = "";
CONTEXT.podname= "";

const { init } = require("./lib");

const USAGE = {
        "name": "getpod.js",
        "description": "Read a single pod.",
        "context": CONTEXT,
        "options": {
            "namespace": "Pod namespace.",
            "podname": "Pod name to read.",
            "mode": "\"default\" prints the name; anything else prints full JSON."
        },
        "examples": [
            "node src/getpod.js namespace=ns-dev podname=my-pod-0 mode=json"
        ]
    };

init(USAGE);

// Run the function
getPods(CONTEXT);

