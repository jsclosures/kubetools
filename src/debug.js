const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
require("./lib").skipTlsVerify(kc);

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// Parse a truthy flag value (true/1/yes, case-insensitive).
function isTruthy(value) {
    const v = String(value || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
}

// Attempt to remove a previously-added ephemeral debug container.
//
// NOTE: Kubernetes does not actually support removing ephemeral containers from a
// running pod (the ephemeralContainers subresource only allows additions). The API
// server will normally reject this request; in that case we surface a clear
// explanation. The only reliable way to remove one is to recreate the pod.
async function removeDebug(ctx){
  try {
    const pod = await k8sApi.readNamespacedPod({name: ctx.podname, namespace: ctx.namespace});
    const existing = (pod.spec && pod.spec.ephemeralContainers) || [];
    const found = existing.some((c) => c.name === ctx.debugcontainername);
    if (!found) {
      console.error(`No ephemeral container named '${ctx.debugcontainername}' found on pod ${ctx.podname} in namespace ${ctx.namespace}.`);
      process.exitCode = 1;
      return;
    }

    pod.spec.ephemeralContainers = existing.filter((c) => c.name !== ctx.debugcontainername);
    await k8sApi.replaceNamespacedPodEphemeralcontainers({name: ctx.podname, namespace: ctx.namespace, body: pod});

    console.log(`Removal request for ephemeral container '${ctx.debugcontainername}' on ${ctx.podname} was accepted by the API server.`);
    console.log("If the container still appears, recreate the pod to fully clear it (Kubernetes generally retains ephemeral containers).");
  } catch (err) {
    console.error('Error removing ephemeral container:', err.body || err);
    console.error("Note: Kubernetes generally does not allow removing ephemeral containers from a running pod. To fully clear it, recreate the pod (e.g. delete the pod and let its controller recreate it).");
    process.exitCode = 1;
  }
}

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
CONTEXT.remove = "";

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
            "targetcontainername": "Existing container to share process namespace with.",
            "remove": "Set true/1/yes to remove the ephemeral container named by debugcontainername instead of adding one (note: Kubernetes generally forbids removing ephemeral containers; the pod usually must be recreated)."
        },
        "examples": [
            "node src/debug.js namespace=ns-dev podname=my-pod-0",
            "node src/debug.js namespace=ns-dev podname=my-pod-0 debugcontainername=debugger remove=true"
        ]
    };

init(USAGE);

if (isTruthy(CONTEXT.remove)) {
    removeDebug(CONTEXT);
} else {
    doDebug(CONTEXT);
}
