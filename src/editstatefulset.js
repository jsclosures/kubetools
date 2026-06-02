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
      if (!ctx || !ctx.namespace || !ctx.statefulsetname || !ctx.path || !ctx.value) {
        console.log('Skipping invalid context. namespace=x statefulsetname=d path=p value=value');
        return;
      }

      const { namespace,statefulsetname,path,op,value } = ctx;
      console.log(` ${namespace} operation: ${op} statefulset:${statefulsetname} path ${path} to ${value}`);

      const patch = [{op,path,value}];
      const name = ctx.statefulsetname;
      let api = appsApi;

      try {
	 console.log("starting",statefulsetname);
	 console.log("namespace", namespace);
         await api.patchNamespacedStatefulSet({"namespace": namespace, "name": name,"body": patch});

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
CONTEXT.statefulsetname = "ns-test-kafka";
CONTEXT.op = "replace";
CONTEXT.path = "/spec/volumeClaimTemplates/0/spec/resources/requests/storage";
CONTEXT.value = "100Gi";

const { init } = require("./lib");

const USAGE = {
        "name": "editstatefulset.js",
        "description": "Patch a StatefulSet with a single JSON Patch operation.",
        "context": CONTEXT,
        "options": {
            "namespace": "StatefulSet namespace.",
            "statefulsetname": "StatefulSet to patch.",
            "op": "JSON Patch op.",
            "path": "JSON Patch path.",
            "value": "New value for the path."
        },
        "examples": [
            "node src/editstatefulset.js statefulsetname=my-sts path=/spec/replicas value=3"
        ]
    };

init(USAGE);
// Usage
editConfig(CONTEXT);

