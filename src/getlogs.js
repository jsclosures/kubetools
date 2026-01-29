const fs = require("fs");
const k8s = require('@kubernetes/client-node');
async function getPods(ctx) {
    let result = [];
    let namespace = ctx.namespace;
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    console.log(`Attempting to get pods in namesapce ${namespace}`);

    try {
        const res = await k8sApi.listNamespacedPod(
                {namespace}
        );
        res.items.forEach((item) => result.push(item.metadata.name));
        console.log(`${result}`);
    } catch (err) {
        console.error('Error getting pods:', err.body || err);
    }
    return( result );
}


async function getPodLogs(ctx,podName, namespace, containerName = null) {
    try {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault(); // Loads configuration from ~/.kube/config or environment variables

        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

        const logOptions = {
            follow: false, // Set to true for streaming logs
            tailLines: 100, // Get the last 100 lines
            timestamps: true, // Include timestamps
            previous: false, // Get logs from a previous terminated container (if applicable)
        };

        if (containerName) {
            logOptions.container = containerName;
        }

	    //const logStream = await k8sApi.readNamespacedPodLog(podName, namespace, containerName, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, logOptions.tailLines, logOptions.timestamps, logOptions.follow, logOptions.previous);
        const args = {"name": podName, "namespace": namespace};
	if( containerName ){
		args.container = containerName;
	}

        const logStream = await k8sApi.readNamespacedPodLog(args,{
    follow: false,
    pretty: false,
    timestamps: false,
    tailLines: 100
});
	    console.log("response",typeof logStream);
        let logs = logStream; 
	if( typeof logStream != 'string' ){
        // For non-streaming logs (follow: false)
        logs = await new Promise((resolve, reject) => {
            let data = '';
            logStream.response.on('data', (chunk) => {
                data += chunk.toString();
            });
            logStream.response.on('end', () => {
                resolve(data);
            });
            logStream.response.on('error', (err) => {
                reject(err);
            });
        });
	}
        if( ctx.filename ){
            fs.writeFileSync(podName + '.txt', logs, 'utf8');
	}
        else {
           console.log(`Logs for pod ${podName} in namespace ${namespace}:`);
           console.log(logs);
	}

    } catch (err) {
        console.error('Error fetching pod logs:', err);
    }
}

// Usage example:
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.podname = "";
CONTEXT.containername = "";
CONTEXT.file = "out.log";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});

// Optional: If your pod has multiple containers, specify the container name
// const myContainerName = 'my-app-container'; 
(async () => {
if( CONTEXT.podname == "*" ){
    let pods = await getPods(CONTEXT);
	console.log(pods);
    if( pods ){
       pods.forEach((item) => getPodLogs(CONTEXT,item,CONTEXT.namespace,null));     
    }
    else {
	    console.log("no pods",CONTEXT);
   }
} else if( CONTEXT.containername ){
     getPodLogs(CONTEXT,CONTEXT.podname, CONTEXT.namespace,CONTEXT.containername); 
}
else {
     getPodLogs(CONTEXT,CONTEXT.podname, CONTEXT.namespace); 
}
})();
// getPodLogs(myPodName, myNamespace, myContainerName); // For multi-container pods
