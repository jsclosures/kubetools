//
// kubetools — overview of the available scripts.
//
// Run any script directly with Node, passing key=value arguments. Every script
// resolves its configuration as: built-in defaults < environment variables <
// command-line key=value, and prints its own usage with -h, --help, or help.
//

const COMMANDS = [
    ["getnamespaces.js", "List all namespaces in the cluster."],
    ["getpods.js", "List pods in a namespace."],
    ["getpod.js", "Read a single pod."],
    ["getdeployments.js", "List Deployments in a namespace."],
    ["getstatefulsets.js", "List StatefulSets in a namespace."],
    ["getpvcs.js", "List PersistentVolumeClaims in a namespace."],
    ["getevents.js", "List events in a namespace."],
    ["getpodevents.js", "List events in a namespace (scoped around a pod)."],
    ["getlogs.js", "Fetch pod logs (podname=* for all pods) and write them to a file."],
    ["describe.js", "Describe (read) a single Deployment."],
    ["describestatefulset.js", "Describe (read) a single StatefulSet."],
    ["hpa.js", "Describe a HorizontalPodAutoscaler."],
    ["scaledeployment.js", "Scale a Deployment or StatefulSet to a replica count."],
    ["editdeployment.js", "Patch a Deployment with a single JSON Patch operation."],
    ["editstatefulset.js", "Patch a StatefulSet with a single JSON Patch operation."],
    ["editpvc.js", "Patch a PersistentVolumeClaim (e.g. grow storage)."],
    ["edithpa.js", "Patch an HPA: min/max replicas and target CPU utilization."],
    ["exec.js", "Open an interactive shell in a pod container."],
    ["debug.js", "Attach an ephemeral debug container to a pod."],
    ["apply.js", "Apply (replace) a resource from a YAML manifest file."],
    ["doexec.js", "Example: run a command non-interactively in a pod (hard-coded sample)."],
];

console.log("kubetools — Kubernetes CLI scripts\n");
console.log("Usage: node src/<script> [key=value ...]");
console.log("Help:  node src/<script> --help    (shows that script's options)\n");
console.log("Precedence: built-in defaults < environment variables < command-line key=value.\n");
console.log("Available scripts:");

const width = Math.max.apply(null, COMMANDS.map(([name]) => name.length));
COMMANDS.forEach(([name, desc]) => {
    console.log(`  ${name.padEnd(width)}  ${desc}`);
});
