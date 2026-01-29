const k8s = require('@kubernetes/client-node');

async function getDeployments(ctx) { 
  let {namespace,mode,replicas} = ctx;

  try {
    // Load the Kubernetes configuration from the default location (~/.kube/config)
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});


getDeployments(CONTEXT)
  .catch(console.error);

