const k8s = require('@kubernetes/client-node');
const { init } = require("./lib");

const USAGE = {
    name: "getnamespaces.js",
    description: "List all namespaces in the cluster.",
    context: {},
    options: {},
    examples: [
        "node src/getnamespaces.js"
    ]
};

init(USAGE);

async function listNamespaces() {
    try {
        // Load Kubernetes configuration from default locations (e.g., ~/.kube/config)
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        require("./lib").skipTlsVerify(kc);

        // Create an API client for CoreV1Api (which handles namespaces)
        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

        // List all namespaces
        const res = await k8sApi.listNamespace();

        console.log('Namespaces:', res);
        res.items.forEach(namespace => {
            console.log(`- ${namespace.metadata.name}`);
        });
    } catch (err) {
        console.error('Error listing namespaces:', err);
    }
}

listNamespaces();
