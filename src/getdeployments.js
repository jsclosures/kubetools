const k8s = require('@kubernetes/client-node');

async function getDeployments(ctx) { 
  let {namespace,mode,replicas} = ctx;

  try {
    // Load the Kubernetes configuration from the default location (~/.kube/config)
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    require("./lib").skipTlsVerify(kc);

    // Create an API client for the Apps V1 API, which manages Deployments
    const appsV1Api = kc.makeApiClient(k8s.AppsV1Api);

    // Call the listNamespacedDeployment function
    const deploymentsRes = await appsV1Api.listNamespacedDeployment({namespace});

    // The response body contains the list of deployments
    const deployments = deploymentsRes.items;


    console.log(`Deployments in namespace "${namespace}":`);
    deployments.forEach((deployment) => {
      if( mode == "default" ){
        console.log(`- ${deployment.metadata.name}`);
        console.log(`  Status: ${deployment.status.conditions[0].status}, Message: ${deployment.status.conditions[0].message}`);
      }
      else {
        console.log(`node scaledeployment.js namespace=${namespace} deploymentname=${deployment.metadata.name} replicas=${replicas ? replicas : deployment.status.replicas}`);
      }
    });

    return deployments;
  } catch (err) {
    console.error('Error fetching deployments:', err);
    throw err;
  }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.mode = "default";
CONTEXT.replicas = "";

const { init } = require("./lib");

const USAGE = {
        "name": "getdeployments.js",
        "description": "List Deployments in a namespace.",
        "context": CONTEXT,
        "options": {
            "namespace": "Namespace to query.",
            "mode": "\"default\" prints names; anything else prints full JSON.",
            "replicas": "Reserved/optional filter."
        },
        "examples": [
            "node src/getdeployments.js namespace=ns-dev"
        ]
    };

init(USAGE);


getDeployments(CONTEXT)
  .catch(console.error);

