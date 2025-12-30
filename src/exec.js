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

Object.keys(process.argv).forEach((ele) => { console.log(process.argv[ele]); if( ele > 1 ){
                                                                                let a = process.argv[ele];
                                                                                let idx = a.indexOf("=");
                                                                                let n = a.substring(0,idx);
                                                                                console.log(n);
                                                                                CONTEXT[n] = process.argv[ele].substring(idx+1);
                                                                           }});
console.log(CONTEXT);

doExec(CONTEXT);
