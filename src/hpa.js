const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // Or from ~/.kube/config

// Use CoreV1Api to get metrics if needed (requires metrics-server)
const coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
// Use AutoscalingV2Api for v2 HPAs
const autoscalingV2Api = kc.makeApiClient(k8s.AutoscalingV2Api);

async function describeHpa(ctx) {
  const hpaName = ctx.hpaname;
  const namespace = ctx.namespace;
  try {
    // Get the HPA object
    const hpa = await autoscalingV2Api.readNamespacedHorizontalPodAutoscaler({name: hpaName, namespace});
console.log(hpa);
    console.log(`--- HPA: ${hpaName} ---`);
    console.log(`Namespace: ${hpa.metadata.namespace}`);
    console.log(`Target: ${hpa.spec.scaleTargetRef.name} (${hpa.spec.scaleTargetRef.kind})`);
    console.log(`Min Replicas: ${hpa.spec.minReplicas}`);
    console.log(`Max Replicas: ${hpa.spec.maxReplicas}`);

    console.log('\n--- Metrics ---');
    hpa.spec.metrics.forEach(metric => {
      if (metric.type === 'Resource') {
        console.log(`- Resource: ${metric.resource.name} (Target: ${metric.resource.target.averageUtilization}%)`);
      } else if (metric.type === 'Pods') {
        console.log(`- Pods: ${metric.pods.metric.name} (Target: ${metric.pods.target.averageValue})`);
      }
      // Add logic for Custom/External metrics if needed
    });

    console.log('\n--- Status ---');
    console.log(`Current Replicas: ${hpa.status.currentReplicas}`);
    console.log(`Desired Replicas: ${hpa.status.desiredReplicas}`);
    console.log(`Current Metrics:`, hpa.status.currentMetrics);

  } catch (err) {
    console.error(`Error describing HPA ${hpaName}:`, err.body || err.message);
  }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-test";
CONTEXT.hpaname = "ns-test-fusion-indexing";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});
console.log(CONTEXT);

describeHpa(CONTEXT);