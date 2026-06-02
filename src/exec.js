const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const exec = new k8s.Exec(kc);

function doExec(ctx){
exec.exec(
    ctx.namespace,
    ctx.podname,
    ctx.containername,
    ctx.shellcommand,
    process.stdout,
    process.stderr,
    process.stdin,
    true /* tty */
).then((ws) => {
    console.log('Shell session started. Type "exit" to end.');
    // Ensure stdin is resumable for interactive input
    process.stdin.resume(); 

    ws.onclose = () => {
        console.log('Shell session ended.');
        process.exit();
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}).catch((err) => {
    console.error('Error opening shell:', err);
});
}
const CONTEXT = {};
CONTEXT.namespace = "ns-test";
CONTEXT.podname = CONTEXT.namespace + "-solr-0";
CONTEXT.shellcommand = "/bin/sh";
CONTEXT.containername = null;

const { init } = require("./lib");

const USAGE = {
        "name": "exec.js",
        "description": "Open an interactive shell (exec) in a pod container.",
        "context": CONTEXT,
        "options": {
            "namespace": "Pod namespace.",
            "podname": "Target pod name.",
            "shellcommand": "Command/shell to run.",
            "containername": "Container to exec into (null = default container)."
        },
        "examples": [
            "node src/exec.js namespace=ns-dev podname=my-pod-0 shellcommand=/bin/bash"
        ]
    };

init(USAGE);

doExec(CONTEXT);
