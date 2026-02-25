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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){ 
										let a = process.argv[ele]; 
										let idx = a.indexOf("=");
										let n = a.substring(0,idx); 
										console.log(n);
										CONTEXT[n] = process.argv[ele].substring(idx+1);
										if( CONTEXT[n].startsWith("\"") ){
											CONTEXT[n] = CONTEXT[n].substring(1,CONTEXT[n].length-2);
										}
									   }});
console.log(CONTEXT);
// Usage
editConfig(CONTEXT);

