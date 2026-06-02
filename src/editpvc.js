const k8s = require('@kubernetes/client-node');

// Function to load the kubeconfig from default location
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Create API clients for CoreV1 (e.g., Pods, Services) and AppsV1 (e.g., Deployments) APIs
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);

/**
 * Applies a Kubernetes resource definition from a YAML file.
 * This simulates the behavior of 'kubectl apply -f'.
 * @param {string} filePath The path to the YAML file.
 * @param {string} namespace The Kubernetes namespace (e.g., 'default').
 */
async function editConfig(ctx) {
  try {
      if (!ctx || !ctx.namespace || !ctx.pvcname || !ctx.path || !ctx.value) {
        console.log('Skipping invalid context. namespace=x pvcname=d path=p value=value');
        return;
      }

      const { namespace,pvcname,path,op,value } = ctx;
      console.log(` ${namespace} operation: ${op} statefulset:${pvcname} path ${path} to ${value}`);

      const patch = [{op,path,value}];
      const name = ctx.pvcname;
      let api = k8sApi;

      try {
	 console.log("starting",pvcname);
	 console.log("namespace", namespace);
         await api.patchNamespacedPersistentVolumeClaim({"namespace": namespace, "name": name,"body": patch});

        console.log(`${op} ${path} ${value}`);
      } 
      catch(err) {
	console.log(err);
      }
    }
   catch (err) {
    console.error('Error editing config:', err.message);
  }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-test";
CONTEXT.pvcname = "data-ns-test-kafka-2";
CONTEXT.op = "replace";
CONTEXT.path = "/spec/resources/requests/storage";
CONTEXT.value = "150Gi";

const { init } = require("./lib");

const USAGE = {
        "name": "editpvc.js",
        "description": "Patch a PersistentVolumeClaim with a single JSON Patch operation (e.g. grow storage).",
        "context": CONTEXT,
        "options": {
            "namespace": "PVC namespace.",
            "pvcname": "PVC to patch.",
            "op": "JSON Patch op.",
            "path": "JSON Patch path.",
            "value": "New value for the path."
        },
        "examples": [
            "node src/editpvc.js pvcname=data-my-sts-0 path=/spec/resources/requests/storage value=150Gi"
        ]
    };

init(USAGE);
// Usage
editConfig(CONTEXT);

