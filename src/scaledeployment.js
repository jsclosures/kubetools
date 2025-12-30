const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});

// Run the function
scaleDeployment(CONTEXT);

