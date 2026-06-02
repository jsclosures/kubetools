const k8s = require('@kubernetes/client-node');

async function getPVCs(ctx) {
  let {namespace,replicas,mode} = ctx;
  try {
    // Load the Kubernetes configuration from the default location (~/.kube/config)
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    require("./lib").skipTlsVerify(kc);

    // Create an API client for the Apps V1 API, which manages StatefulSets
    const appsV1Api = kc.makeApiClient(k8s.CoreV1Api);

    // Call the listNamespacedDeployment function
    const statefulsetsRes = await appsV1Api.listNamespacedPersistentVolumeClaim({namespace: namespace});
console.log(statefulsetsRes);
    // The response body contains the list of statefulsets
    const statefulsets = statefulsetsRes.items;

    if( mode == "default" ){
      console.log(`PVCs in namespace "${namespace}":`);
    }
    statefulsets.forEach((deployment) => {
	    //console.log(deployment.spec.resources.requests.storage);
	    //console.log(deployment);
      if( mode == "default" ){
        console.log(`- ${deployment.metadata.name}`);
        console.log(`  Storage:  ${deployment.spec.resources.requests.storage}`);
      }
      else {
        console.log(`node scaledeployment.js namespace=${namespace} statefulsetname=${deployment.metadata.name} storage=${deployment.spec.resources.requests.storage}`);
      }
    });

    return statefulsets;
  } catch (err) {
    console.error('Error fetching statefulsets:', err);
    throw err;
  }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.replicas = "";
CONTEXT.mode = "default";

const { init } = require("./lib");

const USAGE = {
        "name": "getpvcs.js",
        "description": "List PersistentVolumeClaims in a namespace.",
        "context": CONTEXT,
        "options": {
            "namespace": "Namespace to query.",
            "mode": "\"default\" prints names; anything else prints full JSON.",
            "replicas": "Reserved/optional filter."
        },
        "examples": [
            "node src/getpvcs.js namespace=ns-dev"
        ]
    };

init(USAGE);


getPVCs(CONTEXT)
  .catch(console.error);

