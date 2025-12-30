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
        const res = await k8sApi.listNamespacedEvent(
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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});

// Run the function
getPods(CONTEXT);

