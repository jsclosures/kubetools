const k8s = require('@kubernetes/client-node');

async function getStatefulSets(ctx) {
  let {namespace,replicas,mode} = ctx;
  try {
    // Load the Kubernetes configuration from the default location (~/.kube/config)
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    // Create an API client for the Apps V1 API, which manages StatefulSets
    const appsV1Api = kc.makeApiClient(k8s.AppsV1Api);

    // Call the listNamespacedDeployment function
    const statefulsetsRes = await appsV1Api.listNamespacedStatefulSet({namespace: namespace});

    // The response body contains the list of statefulsets
    const statefulsets = statefulsetsRes.items;

    if( mode == "default" ){
      console.log(`StatefulSets in namespace "${namespace}":`);
    }
    statefulsets.forEach((deployment) => {
	    //console.log(deployment);
      if( mode == "default" ){
        console.log(`- ${deployment.metadata.name}`);
        console.log(`  Replicas:  ${deployment.status.replicas}, Ready: ${deployment.status.readyReplicas}`);
      }
      else {
        console.log(`node scaledeployment.js namespace=${namespace} statefulsetname=${deployment.metadata.name} replicas=${replicas ? replicas : deployment.status.replicas}`);
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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});


getStatefulSets(CONTEXT)
  .catch(console.error);

