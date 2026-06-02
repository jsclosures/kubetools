//
// Execute commands non-interactively in a pod
//
const { init } = require("./lib");

init({
  name: "doexec.js",
  description: "Example: run a command non-interactively in a pod. NOTE: this is a hard-coded sample built on the legacy 'kubernetes-client' library; edit the namespace and pod names in the source before running.",
  context: {},
  options: {},
  examples: [
    "node src/doexec.js"
  ]
});

const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config

async function main () {
  try {
    const client = new Client({ config: config.fromKubeconfig(), version: '1.13' })

    // Pod with single container
    let res = await client.api.v1.namespaces('namespace_name').pods('pod_name').exec.post({
      qs: {
        command: ['ls', '-al'],
        stdout: true,
        stderr: true
      }
    })
    console.log(res.body)
    console.log(res.messages)

    // Pod with multiple containers /must/ specify a container
    res = await client.api.v1.namespaces('namespace_name').pods('pod_name').exec.post({
      qs: {
        command: ['ls', '-al'],
        container: 'container_name',
        stdout: true,
        stderr: true
      }
    })
    console.log(res.body)
  } catch (err) {
    console.error('Error: ', err)
  }
}

main()
