const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

async function doDebug(ctx){
	console.log("ctx: " ,ctx);
  try {
    // 1. Get the current pod manifest to ensure we have the latest version
    const podResponse = await k8sApi.readNamespacedPod({name: ctx.podname,namespace: ctx.namespace});
    const pod = podResponse;
	  console.log(podResponse,pod);

    // Ensure ephemeral containers list exists
    if (!pod.spec.ephemeralContainers) {
      pod.spec.ephemeralContainers = [];
    }

    // 2. Define the ephemeral container spec
    const ephemeralContainer = {
      name: ctx.debugcontainername,
      image: ctx.debugimage,
      command: ['sh', '-c', 'sleep infinity'], // Command to keep container running
      // Optionally share process namespace like 'kubectl debug --share-processes'
      // targetContainerName: 'my-app-container' // Target container name if needed
    };

    pod.spec.ephemeralContainers.push(ephemeralContainer);

    // 3. Patch the pod to add the ephemeral container
    // Note: This operation uses a specific subresource API call for ephemeralcontainers
    // The standard replaceNamespacedPod might not work correctly for ephemeral containers
    await k8sApi.replaceNamespacedPodEphemeralcontainers({name: ctx.podname, namespace: ctx.namespace, body:  pod});

    console.log(`Successfully added ephemeral container '${ctx.debugimage}' to ${ctx.podname}.`);
    console.log('You can now attach to it using:');
    console.log(`node exec.js namespace=${ctx.namespace} podname=${ctx.podname} containername=${ctx.debugcontainername}`);

  } catch (err) {
    console.error('Error debugging pod:', err.body || err);
    if (err.statusCode === 404) {
        console.error(`Pod "${ctx.podname}" not found in namespace "${ctx.namespace}".`);
    }
    // A 422 error (Unprocessable Entity) often means the EphemeralContainers feature gate is not enabled.
    if (err.statusCode === 422) {
        console.error("The cluster API returned a 422 error. Ensure the 'EphemeralContainers' feature gate is enabled in your Kubernetes cluster.");
    }
  }
}

const CONTEXT = {};
CONTEXT.namespace = "ns-test";
CONTEXT.podname = CONTEXT.namespace + "-solr-0";
CONTEXT.debugimage = "busybox";
CONTEXT.debugcontainername = "debugger";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});
console.log(CONTEXT);

doDebug(CONTEXT);
