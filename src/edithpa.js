const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.AutoscalingV2Api);
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.hpaName = "";
CONTEXT.minReplicas = "2";
CONTEXT.maxReplicas = "2";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});

// JSON Merge Patch to update min/max replicas
const patch = [
    {
        "op": "replace",
        "path": "/spec/minReplicas",
        "value": 2
    },
    {
        "op": "replace",
        "path": "/spec/maxReplicas",
        "value": 2
    }
];
if( CONTEXT.minReplicas )
        patch[0].value = parseInt(CONTEXT.minReplicas);
if( CONTEXT.maxReplicas )
        patch[1].value = parseInt(CONTEXT.maxReplicas);
// Use 'application/json-patch+json' for RFC 6902 JSON Patch
k8sApi.patchNamespacedHorizontalPodAutoscaler(
        { name: CONTEXT.hpaName,
          namespace: CONTEXT.namespace,
          body: patch},
    { headers: { "Content-Type": "application/json-patch+json" } }
).then((response) => {
    console.log('HPA patched successfully');
}).catch((err) => {
    console.error('Error patching HPA:', err);
});
