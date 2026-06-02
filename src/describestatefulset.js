const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.AppsV1Api);


/**
 * Scales a Kubernetes Deployment to a specified number of replicas.
 */
async function getStatefulSet(ctx) {
	let namespace = ctx.namespace;
	let statefulsetname = ctx.statefulsetname;

    console.log(`Attempting to get pods in namesapce ${namespace}`);

    try {
        const res = await k8sApi.readNamespacedStatefulSet(
		{namespace,name: statefulsetname}
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
CONTEXT.statefulsetname= "";

const { init } = require("./lib");

const USAGE = {
        "name": "describestatefulset.js",
        "description": "Describe (read) a single StatefulSet.",
        "context": CONTEXT,
        "options": {
            "namespace": "StatefulSet namespace.",
            "statefulsetname": "StatefulSet name to read.",
            "mode": "\"default\" prints the name; anything else prints full JSON."
        },
        "examples": [
            "node src/describestatefulset.js namespace=ns-dev statefulsetname=my-sts mode=json"
        ]
    };

init(USAGE);

// Run the function
getStatefulSet(CONTEXT);

