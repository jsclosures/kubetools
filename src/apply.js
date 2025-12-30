const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const yaml = require('js-yaml');

// Function to load the kubeconfig from default location
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Create API clients for CoreV1 (e.g., Pods, Services) and AppsV1 (e.g., Deployments) APIs
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const autoscalingV2Api = kc.makeApiClient(k8s.AutoscalingV2Api);


async function applyYaml(ctx) {
  const filePath = CONTEXT.file;
  const namespace = CONTEXT.namespace
  try {
    // Read and parse the YAML file
    const specString = fs.readFileSync(filePath, 'utf8');
    // The loadAll function can handle multiple documents in a single YAML file
    const specs = yaml.loadAll(specString);
console.log(specs);
    for (const spec of specs) {
      if (!spec || !spec.kind || !spec.metadata || !spec.metadata.name) {
        console.log('Skipping invalid or incomplete YAML document.');
        continue;
      }

      const { kind, metadata } = spec;
      console.log(`Applying ${kind} resource:${kind}/${metadata.name} in namespace ${namespace}`);

	      console.log("Check ",kind.includes("Autoscal"));
      // Determine the correct API client based on the 'kind' and 'apiVersion'
      let api;
      if (spec.apiVersion.includes('apps')) {
        api = appsApi;
      } else if (spec.apiVersion.includes('v1')) {
        api = k8sApi;
      } else if (spec.apiVersion.includes('autoscal')) {
        api = autoscalingV2Api;
      } else {
        console.log(`Unsupported apiVersion: ${spec.apiVersion}, skipping.`);
        continue;
      }

      try {
	 console.log("starting",api);
	 console.log("namespace", namespace);
        // Attempt to create the resource
        if (kind === 'Deployment') {
          await api.createNamespacedDeployment({"namespace": namespace, "body": spec});
        } else if (kind === 'Service') {
          await api.createNamespacedService({"namespace": namespace, "body": spec});
        } else if (kind.includes('Autoscal') ) {
		console.log("doingautoscale");
          let r = await api.readNamespacedHorizontalPodAutoscaler({"name": spec.metadata.name,"namespace": namespace, "body": spec});
	  console.log("current setting",JSON.stringify(r));
        }
        // Add more kinds as needed

        console.log(`Created ${kind}/${metadata.name}`);
      } catch (err) {
        // If creation fails (e.g., resource already exists), attempt to patch it
	console.log(err);
        if (err.body.reason === 'AlreadyExists') {
          console.log(`Resource ${kind}/${metadata.name} already exists. Attempting to patch.`);

          // Patch the resource
          // Note: The 'apply' equivalent is complex and often involves 'patch' with a merge strategy.
          // For simplicity, this example uses the 'replace' method in the try-catch flow, which
          // is less ideal than a true 'apply' but demonstrates the update concept. A true apply
          // implementation is more involved.
          if (kind === 'Deployment') {
             await api.replaceNamespacedDeployment(metadata.name, namespace, spec);
          } else if (kind === 'Service') {
             await api.replaceNamespacedService(metadata.name, namespace, spec);
          } else if (kind.includes('Autoscal') ) {
            await api.replaceNamespacedHorizontalPodAutoscaler({"namespace": namespace, "body": spec});
          }
          // Add more kinds as needed

          console.log(`Patched ${kind}/${metadata.name}`);
        } else {
          throw err; // Re-throw other errors
        }
      }
    }
  } catch (err) {
    console.error('Error applying YAML:', err.message);
  }
}
const CONTEXT = {};
CONTEXT.namespace = "ns-dev";
CONTEXT.file = "chrome-deployment.yaml";

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){ 
										let a = process.argv[ele]; 
										let idx = a.indexOf("=");
										let n = a.substring(0,idx); 
										console.log(n);
										CONTEXT[n] = process.argv[ele].substring(idx+1);
									   }});
console.log(CONTEXT);
// Usage
applyYaml(CONTEXXT);

