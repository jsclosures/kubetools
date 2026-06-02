const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.AppsV1Api);


/**
 * Scales a Kubernetes Deployment to a specified number of replicas.
 */
async function scaleDeployment(ctx) {
	let deploymentname = ctx.deploymentname;
	let statefulsetname = ctx.statefulsetname;
	let namespace = ctx.namespace;
	let replicas = parseInt(ctx.replicas);


    const patch = [{
        "op": "replace",
        "path": "/spec/replicas",
        "value": replicas
    }];

    try {
	    if( statefulsetname ){
                console.log(`Attempting to scale deployment ${statefulsetname} in namespace ${namespace} to ${replicas} replicas...`);
                await k8sApi.patchNamespacedStatefulSet(
		{name: statefulsetname,
                 namespace,
                 body: patch,
                 options: {'headers': {'content-type': 'application/json-patch+json'}}
	        });
                console.log(`Successfully scaled statefulset ${statefulsetname} to ${replicas} replicas.`);
	    }
	    else {
                console.log(`Attempting to scale deployment ${deploymentname} in namespace ${namespace} to ${replicas} replicas...`);
                await k8sApi.patchNamespacedDeployment(
		{name: deploymentname,
                 namespace,
                 body: patch,
                 options: {'headers': {'content-type': 'application/json-patch+json'}}
	        });
                console.log(`Successfully scaled deployment ${deploymentname} to ${replicas} replicas.`);
           }
    } catch (err) {
        console.error('Error scaling deployment:', err.body || err);
    }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.deploymentname = "";
CONTEXT.statefulsetname = "";
CONTEXT.replicas = "";

const { init } = require("./lib");

const USAGE = {
        "name": "scaledeployment.js",
        "description": "Scale a Deployment or StatefulSet to a replica count.",
        "context": CONTEXT,
        "options": {
            "namespace": "Resource namespace.",
            "deploymentname": "Deployment to scale (leave empty to scale a StatefulSet).",
            "statefulsetname": "StatefulSet to scale (takes precedence when set).",
            "replicas": "Desired replica count."
        },
        "examples": [
            "node src/scaledeployment.js deploymentname=my-deploy replicas=3",
            "node src/scaledeployment.js statefulsetname=my-sts replicas=5"
        ]
    };

init(USAGE);

// Run the function
scaleDeployment(CONTEXT);

