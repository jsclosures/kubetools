const k8s = require('@kubernetes/client-node');

async function getKubernetesEvents(ctx) {
  let namespace = ctx.namespace;
  
  try {
    console.log("using namespace",namespace);
    const kc = new k8s.KubeConfig();
    // Load configuration from default locations (e.g., ~/.kube/config)

    kc.loadFromDefault(); 
    //kc.setCurrentContext('phc-fusion-tst-aks-01');

    // Create an API client for the CoreV1Api, which handles events
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    // List events in a specific namespace (e.g., 'default')
    // You can remove .namespace('default') to list events across all namespaces,
    // or specify a different namespace.
    const res = await k8sApi.listNamespacedEvent({namespace: namespace}); 
    console.log('Kubernetes Events in "' + namespace + '" namespace:');
    res.items.forEach(event => {
      console.log(`  - Type: ${event.type}, Reason: ${event.reason}, Message: ${event.message}, Involved Object: ${event.involvedObject.kind}/${event.involvedObject.name}`);
    });

  } catch (err) {
    console.error('Error fetching Kubernetes events:', err);
  }
}

const CONTEXT = {};
CONTEXT.namespace = "ns-dev";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});

// Run the function
getEvents(CONTEXT);