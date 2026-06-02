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
      tty: true,
      stdin: true,
      command: ['sh','-c', 'sleep infinity'], 
	    targetContainerName: ctx.targetcontainername
    };

    pod.spec.ephemeralContainers.push(ephemeralContainer);

    // 3. Patch the pod to add the ephemeral container
    // Note: This operation uses a specific subresource API call for ephemeralcontainers
    // The standard replaceNamespacedPod might not work correctly for ephemeral containers
    await k8sApi.replaceNamespacedPodEphemeralcontainers({name: ctx.podname, namespace: ctx.namespace, body:  pod});

    console.log(`Successfully added ephemeral container '${ctx.debugimage}' to ${ctx.podname}.`);
    console.log('You can now attach to it using:');
    console.log(`node exec.js namespace=${ctx.namespace} podname=${ctx.podname} containername=${ctx.targetcontainername}`);

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
CONTEXT.targetcontainername = "debugger";

const { init } = require("./lib");

const USAGE = {
        "name": "debug.js",
        "description": "Attach an ephemeral debug container to a running pod.",
        "context": CONTEXT,
        "options": {
            "namespace": "Pod namespace.",
            "podname": "Target pod name.",
            "debugimage": "Image to run as the debug container.",
            "debugcontainername": "Name for the ephemeral debug container.",
            "targetcontainername": "Existing container to share process namespace with."
        },
        "examples": [
            "node src/debug.js namespace=ns-dev podname=my-pod-0"
        ]
    };

init(USAGE);

doDebug(CONTEXT);
