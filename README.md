# kubetools — Documentation

A collection of Node.js scripts that replicate the most common `kubectl` operations via the official `@kubernetes/client-node` SDK. Each script reads your local kubeconfig automatically and accepts parameters from the command line. All scripts share a common helper (`src/lib.js`) that gives them a uniform `key=value` argument convention, environment-variable support, and a `--help` message.

Run `node src/index.js` to print a catalog of every available script.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [How Arguments Work](#how-arguments-work)
- [Scripts](#scripts)
  - [All scripts at a glance](#all-scripts-at-a-glance)
  - [apply.js — Apply YAML resources](#applyjs--apply-yaml-resources)
  - [describe.js — Describe a deployment](#describejs--describe-a-deployment)
  - [editdeployment.js — Patch a deployment](#editdeploymentjs--patch-a-deployment)
  - [exec.js — Open a shell in a pod](#execjs--open-a-shell-in-a-pod)
  - [debug.js — Attach an ephemeral debug container](#debugjs--attach-an-ephemeral-debug-container)
  - [getevents.js — List namespace events](#geteventsjs--list-namespace-events)
  - [getlogs.js — Fetch pod logs](#getlogsjs--fetch-pod-logs)
  - [getnamespaces.js — List namespaces](#getnamespacesjs--list-namespaces)
  - [getpods.js — List pods in a namespace](#getpodsjs--list-pods-in-a-namespace)
  - [scaledeployment.js — Scale a deployment or StatefulSet](#scaledeploymentjs--scale-a-deployment-or-statefulset)
  - [rolloutrestart.js — Rolling-restart a deployment](#rolloutrestartjs--rolling-restart-a-deployment)
  - [forward.js — Port-forward to a service or pod](#forwardjs--port-forward-to-a-service-or-pod)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | Scripts use `async/await` and modern JS features |
| `@kubernetes/client-node` | Kubernetes API client — install via `npm install` |
| `js-yaml` | Required only by `apply.js` |
| A valid kubeconfig | Loaded automatically from `~/.kube/config` or the `KUBECONFIG` environment variable |
| Cluster access | Your current kubeconfig context must have the appropriate RBAC permissions |

---

## Installation

```bash
git clone https://github.com/jsclosures/kubetools.git
cd kubetools
npm install
```

---

## How Arguments Work

All scripts share the same command-line argument convention. Arguments are passed as `key=value` pairs after the script name:

```bash
node <script>.js key1=value1 key2=value2
```

Each script defines a `CONTEXT` object with default values. A value is resolved with the following precedence, lowest to highest:

1. **Built-in defaults** — the values baked into the script's `CONTEXT`.
2. **Environment variables** — any environment variable whose name matches a `CONTEXT` key overrides that default.
3. **Command-line `key=value`** — anything passed on the command line overrides both of the above.

This means you can run a script with no arguments to use its defaults, set environment variables for values you reuse often, and override anything per-invocation on the command line.

**Example:**

```bash
# Uses defaults (namespace=ns-dev, mode=default)
node src/getpods.js

# Set the namespace via environment variable
namespace=staging node src/getpods.js

# Command-line value wins over the environment variable (uses production)
namespace=staging node src/getpods.js namespace=production

# Override multiple values
node src/getpods.js namespace=production mode=verbose
```

### Help

Every script accepts `-h`, `--help`, or `help` and prints a usage message describing its options, defaults, and examples — then exits without contacting the cluster:

```bash
node src/getpods.js --help
```

### TLS verification

By default, **these scripts skip TLS certificate verification** for the cluster. After loading your kubeconfig, each script calls a shared helper that sets `skipTLSVerify` on every cluster. This makes the tools tolerate self-signed or untrusted cluster certificates, and it also avoids the v1.x client error `HTTP protocol is not allowed when skipTLSVerify is not set or false` when a cluster's `server:` URL uses plain `http://`.

To opt back in to normal certificate verification, set the `KUBE_VERIFY_TLS` environment variable:

```bash
KUBE_VERIFY_TLS=true node src/getpods.js
```

> **Security note:** Skipping verification means the client will not detect a man-in-the-middle or an unexpected server certificate. It is convenient for self-managed/dev clusters; set `KUBE_VERIFY_TLS=true` when talking to clusters where you want the certificate enforced.

> **Note:** Values that contain spaces or special characters should be quoted in your shell, e.g. `value="my long string"`. The `editdeployment.js` script additionally strips leading/trailing double-quotes from values automatically.

---

## Scripts

### All scripts at a glance

The complete toolkit. Run `node src/index.js` to print this catalog from the command line. Scripts with a dedicated section below are linked.

| Script | Purpose |
|---|---|
| **List / read** | |
| [`getnamespaces.js`](#getnamespacesjs--list-namespaces) | List all namespaces in the cluster. |
| [`getpods.js`](#getpodsjs--list-pods-in-a-namespace) | List pods in a namespace. |
| `getpod.js` | Read a single pod. |
| `getdeployments.js` | List Deployments in a namespace. |
| `getstatefulsets.js` | List StatefulSets in a namespace. |
| `getpvcs.js` | List PersistentVolumeClaims in a namespace. |
| [`getevents.js`](#geteventsjs--list-namespace-events) | List events in a namespace. |
| `getpodevents.js` | List events in a namespace, scoped around a pod. |
| [`getlogs.js`](#getlogsjs--fetch-pod-logs) | Fetch and print pod logs (`podname=*` for all pods; `previous=true` for the prior instance). |
| [`describe.js`](#describejs--describe-a-deployment) | Describe (read) a single Deployment. |
| `describestatefulset.js` | Describe (read) a single StatefulSet. |
| `hpa.js` | Describe a HorizontalPodAutoscaler. |
| **Scale / restart** | |
| [`scaledeployment.js`](#scaledeploymentjs--scale-a-deployment-or-statefulset) | Scale a Deployment or StatefulSet to a replica count. |
| [`rolloutrestart.js`](#rolloutrestartjs--rolling-restart-a-deployment) | Rolling-restart a Deployment (like `kubectl rollout restart`). |
| **Edit / patch** | |
| [`editdeployment.js`](#editdeploymentjs--patch-a-deployment) | Patch a Deployment with a single JSON Patch operation. |
| `editstatefulset.js` | Patch a StatefulSet with a single JSON Patch operation. |
| `editpvc.js` | Patch a PersistentVolumeClaim (e.g. grow storage). |
| `edithpa.js` | Patch an HPA: min/max replicas and target CPU utilization. |
| **Interact** | |
| [`exec.js`](#execjs--open-a-shell-in-a-pod) | Open an interactive shell in a pod container. |
| [`debug.js`](#debugjs--attach-an-ephemeral-debug-container) | Attach (or remove) an ephemeral debug container on a pod. |
| [`forward.js`](#forwardjs--port-forward-to-a-service-or-pod) | Port-forward a local port to a Service or pod. |
| [`apply.js`](#applyjs--apply-yaml-resources) | Apply (replace) a resource from a YAML manifest file. |
| `doexec.js` | Example: run a command non-interactively in a pod (hard-coded sample). |
| **Helpers** | |
| `index.js` | Print the catalog of all available scripts. |
| `lib.js` | Shared module (argument parsing, help text, TLS skip) — not run directly. |
| `scaleup.sh` | Bulk-scale a preset list of Deployments/StatefulSets **up** for a namespace: `cd src && ./scaleup.sh <namespace>`. |
| `scaledown.sh` | Bulk-scale that same preset list **down to zero**: `cd src && ./scaledown.sh <namespace>`. |

---

### `apply.js` — Apply YAML resources

**Equivalent to:** `kubectl apply -f <file>`

Reads a YAML file (which may contain multiple documents separated by `---`), then creates or updates each resource in the target namespace. Supports `Deployment`, `Service`, and `HorizontalPodAutoscaler` kinds.

**How it works:**
1. Reads and parses the YAML file using `js-yaml`.
2. For each resource document, selects the correct API client based on `apiVersion`:
   - `apps/*` → `AppsV1Api`
   - `v1` → `CoreV1Api`
   - `autoscaling/*` → `AutoscalingV2Api`
3. Attempts to **create** the resource. If the API returns `AlreadyExists`, it falls back to **replacing** (patching) the existing resource.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `file` | `chrome-deployment.yaml` |

**Usage:**

```bash
node src/apply.js file=my-deployment.yaml namespace=staging
```

**Supported resource kinds:**

| Kind | Create | Replace |
|---|---|---|
| `Deployment` | ✅ | ✅ |
| `Service` | ✅ | ✅ |
| `HorizontalPodAutoscaler` | Read-only check | ✅ |

> **Note:** For `HorizontalPodAutoscaler`, the create path currently reads (logs) the existing HPA rather than creating a new one. The replace path is fully functional.

---

### `describe.js` — Describe a deployment

**Equivalent to:** `kubectl describe deployment <name> -n <namespace>`

Fetches the full spec of a named Deployment and prints it. In `default` mode it prints just the deployment name; in any other mode it prints the full JSON representation.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `podname` | *(empty)* |
| `mode` | *(empty — triggers JSON output)* |

**Usage:**

```bash
# Print full JSON of a deployment
node src/describe.js namespace=production podname=my-api-deployment

# Print just the name (default mode)
node src/describe.js namespace=production podname=my-api-deployment mode=default
```

**Output modes:**

| `mode` value | Output |
|---|---|
| `default` | Deployment name only |
| *(anything else or empty)* | Full JSON (pretty-printed with 5-space indent) |

---

### `editdeployment.js` — Patch a deployment

**Equivalent to:** `kubectl patch deployment <name> --type=json -p '[...]'`

Applies a single JSON Patch operation to a named Deployment. Useful for changing environment variables, image tags, resource limits, or any other field accessible via a JSON Pointer path.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-test` |
| `deploymentname` | `ns-test-connectors` |
| `op` | `replace` |
| `path` | `/spec/template/spec/containers/0/env/4/value` |
| `value` | *(a long JVM flags string)* |

**Usage:**

```bash
# Change the replica count of a deployment
node src/editdeployment.js \
  namespace=production \
  deploymentname=my-api \
  op=replace \
  path=/spec/replicas \
  value=3

# Update an environment variable (index 0, first env var)
node src/editdeployment.js \
  namespace=staging \
  deploymentname=my-worker \
  op=replace \
  path=/spec/template/spec/containers/0/env/0/value \
  value=new-value
```

**Supported JSON Patch operations (`op`):**

| Operation | Effect |
|---|---|
| `replace` | Replaces the value at `path` |
| `add` | Adds a new value at `path` |
| `remove` | Removes the value at `path` |

**Finding the right path:**

Use `describe.js` with no `mode` argument to print the full JSON of a deployment. Count the array index for the container or env var you want to change and build the path accordingly.

---

### `exec.js` — Open a shell in a pod

**Equivalent to:** `kubectl exec -it <pod> -n <namespace> -- /bin/sh`

Opens an interactive WebSocket-based shell session to a running pod. stdin/stdout/stderr are forwarded to your terminal. The session ends when you type `exit` or the WebSocket closes.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-test` |
| `podname` | `ns-test-solr-0` |
| `shellcommand` | `/bin/sh` |
| `containername` | `null` *(uses the first/only container)* |

**Usage:**

```bash
# Shell into a pod using the default shell
node src/exec.js namespace=production podname=my-api-pod-abc123

# Use bash instead of sh
node src/exec.js namespace=staging podname=my-worker-xyz containername=worker shellcommand=/bin/bash
```

> **Tip:** `podname` must be the exact pod name (not the deployment name). Use `getpods.js` first to find the current pod names.

---

### `debug.js` — Attach an ephemeral debug container

**Equivalent to:** `kubectl debug -it <pod> --image=<image> --target=<container>`

Injects an ephemeral container into a running pod. The container runs `sleep infinity` so you can then attach to it with `exec.js`. This is useful for debugging pods whose main image does not include diagnostic tools.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-test` |
| `podname` | `ns-test-solr-0` |
| `debugimage` | `busybox` |
| `debugcontainername` | `debugger` |
| `targetcontainername` | `debugger` |
| `remove` | *(empty — set `true`/`1`/`yes` to remove instead of add)* |

**Usage:**

```bash
# Inject a busybox sidecar into a pod
node debug.js namespace=production podname=my-api-pod-abc123

# Use a richer debug image
node debug.js \
  namespace=staging \
  podname=my-worker-xyz \
  debugimage=nicolaka/netshoot \
  debugcontainername=net-debug
```

**After running `debug.js`, attach to the container:**

```bash
node src/exec.js \
  namespace=<namespace> \
  podname=<podname> \
  containername=<debugcontainername>
```

**Removing the debug container:**

Pass `remove=true` to remove the ephemeral container named by `debugcontainername`:

```bash
node src/debug.js \
  namespace=ns-dev \
  podname=my-pod-0 \
  debugcontainername=debugger \
  remove=true
```

> **Important:** Kubernetes generally does **not** allow removing ephemeral containers from a running pod — the `ephemeralContainers` subresource only permits additions. This switch is best-effort: it attempts the removal and, if the API server rejects it (the usual case), prints a note explaining that the pod must be recreated (e.g. delete the pod and let its controller recreate it) to fully clear the container. If the named container is not present, the script reports it and exits non-zero.

**Error handling:**

| Error | Cause |
|---|---|
| `404 Not Found` | The pod name does not exist in that namespace |
| `422 Unprocessable Entity` | The cluster does not have the `EphemeralContainers` feature gate enabled |

---

### `getevents.js` — List namespace events

**Equivalent to:** `kubectl get events -n <namespace>`

Lists all Kubernetes events in a given namespace, printing the type, reason, message, and the object the event relates to.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-test` |

**Usage:**

```bash
# Use default namespace
node src/getevents.js

# Specify namespace
node src/getevents.js namespace=production
```

**Example output:**

```
Kubernetes Events in "production" namespace:
 - Type: Warning, Reason: BackOff, Message: Back-off restarting failed container, Involved Object: Pod/my-api-abc
 - Type: Normal, Reason: Pulled, Message: Successfully pulled image "my-image:latest", Involved Object: Pod/my-api-def
```

---

### `getlogs.js` — Fetch pod logs

**Equivalent to:** `kubectl logs <pod> [-c <container>] [--previous]`

Fetches the last 100 log lines from a pod and prints them to stdout. Pass `podname=*` to fetch logs from **all** pods in the namespace (the script lists them first, then reads each one). Use `containername` to read a specific container in a multi-container pod.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `podname` | *(empty — or `*` for all pods in the namespace)* |
| `containername` | *(empty — defaults to the pod's default container)* |
| `previous` | *(empty — set `true`/`1`/`yes` to read the previous container instance)* |

> **Note:** Logs are printed to stdout; redirect to a file with your shell (e.g. `node src/getlogs.js podname=my-pod-0 > out.log`).

**Usage:**

```bash
# Fetch logs from a single pod
node src/getlogs.js namespace=ns-dev podname=my-pod-0

# Fetch logs from a specific container
node src/getlogs.js namespace=ns-dev podname=my-pod-0 containername=app

# Fetch logs from all pods in the namespace
node src/getlogs.js namespace=ns-dev podname=*

# Read logs from the previously terminated container (crash debugging)
node src/getlogs.js namespace=ns-dev podname=my-pod-0 previous=true
```

> **Note:** `previous=true` is equivalent to `kubectl logs --previous` — it reads logs from the previously terminated instance of the container, which is useful for diagnosing a pod that crashed and restarted. If the container has no prior terminated instance, the cluster returns an error (same behavior as `kubectl`).

---

### `getnamespaces.js` — List namespaces

**Equivalent to:** `kubectl get namespaces`

Fetches and prints all namespaces in the current cluster context. Takes no arguments.

**Usage:**

```bash
node src/getnamespaces.js
```

**Example output:**

```
- default
- kube-system
- kube-public
- ns-dev
- ns-test
- production
```

---

### `getpods.js` — List pods in a namespace

**Equivalent to:** `kubectl get pods -n <namespace>`

Lists all pods in a namespace. In `default` mode, prints one pod name per line — handy for piping or scripting. In verbose mode, prints the full JSON response for all pods.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `mode` | `default` |

**Usage:**

```bash
# List pod names in the default namespace
node src/getpods.js

# List pods in a different namespace
node src/getpods.js namespace=production

# Full JSON output
node src/getpods.js namespace=staging mode=verbose
```

**Output modes:**

| `mode` value | Output |
|---|---|
| `default` | One pod name per line |
| *(anything else)* | Full JSON (pretty-printed with 5-space indent) |

---

### `scaledeployment.js` — Scale a deployment or StatefulSet

**Equivalent to:** `kubectl scale deployment <name> --replicas=<n>` or `kubectl scale statefulset <name> --replicas=<n>`

Sets the replica count for a Deployment or a StatefulSet using a JSON Patch. Provide either `deploymentname` or `statefulsetname` — if `statefulsetname` is set, it takes priority.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `deploymentname` | *(empty)* |
| `statefulsetname` | *(empty)* |
| `replicas` | *(empty)* |

**Usage:**

```bash
# Scale a Deployment to 3 replicas
node src/scaledeployment.js \
  namespace=production \
  deploymentname=my-api \
  replicas=3

# Scale a StatefulSet to 2 replicas
node src/scaledeployment.js \
  namespace=production \
  statefulsetname=my-db \
  replicas=2

# Scale down to zero (stop all pods)
node src/scaledeployment.js \
  namespace=staging \
  deploymentname=my-worker \
  replicas=0
```

> **Note:** `replicas` is parsed as an integer with `parseInt`. Passing a non-numeric value will result in `NaN` and the API call will likely fail with a validation error.

---

### `rolloutrestart.js` — Rolling-restart a deployment

**Equivalent to:** `kubectl rollout restart deployment <name> -n <namespace>`

Triggers a rolling restart of a Deployment. Like `kubectl`, it stamps a `kubectl.kubernetes.io/restartedAt` annotation (with the current timestamp) onto the pod template. Changing the template starts a new rollout, restarting the pods in batches according to the Deployment's rolling-update strategy. A strategic-merge patch is used so the annotation is merged in without disturbing any existing template annotations.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `deploymentname` | *(empty — required)* |

**Usage:**

```bash
# Restart a deployment in the default namespace
node src/rolloutrestart.js deploymentname=my-deploy

# Restart a deployment in another namespace
node src/rolloutrestart.js namespace=production deploymentname=my-api
```

> **Note:** `deploymentname` is required; running without it prints an error. The restart is asynchronous — the command returns once the rollout is triggered, not when all pods have finished restarting.

---

### `forward.js` — Port-forward to a service or pod

**Equivalent to:** `kubectl port-forward service/<name> <localport>:<port>` (and `kubectl port-forward pod/<name> ...`)

Opens a local TCP listener and forwards connections into the cluster. Pass a `servicename` to forward to a Service: the script resolves the Service's selector to a backing pod (preferring a `Running` one) and derives the remote pod port from the Service's `targetPort`. Named target ports are resolved against the chosen pod's container ports. Alternatively, pass a `podname` to forward straight to a pod.

This is a **long-running** command — it stays in the foreground until you stop it with Ctrl+C. The listener binds to `127.0.0.1` only.

**Default context values:**

| Key | Default |
|---|---|
| `namespace` | `ns-dev` |
| `servicename` | *(empty)* |
| `podname` | *(empty — takes precedence over `servicename`; requires `targetport`)* |
| `serviceport` | *(empty — defaults to the first service port)* |
| `targetport` | *(empty — derived from the service; required with `podname`)* |
| `localport` | *(empty — defaults to the resolved remote port)* |

**Usage:**

```bash
# Forward to a service (local port defaults to the resolved remote port)
node src/forward.js servicename=my-svc

# Forward to a service, choosing the local port
node src/forward.js servicename=my-svc localport=8080

# Pick a specific service port when the service exposes several
node src/forward.js servicename=my-svc serviceport=443 localport=8443

# Forward directly to a pod (targetport is required)
node src/forward.js podname=my-pod-0 targetport=8080 localport=8080
```

> **Note:** You must provide either `servicename` or `podname`. When using `podname`, `targetport` is required (there is no service to derive it from). If a service has no selector or no backing pods, the script errors and asks you to target a pod directly.

---

## Common Patterns

### Find a pod name then shell into it

```bash
# Step 1 — find the pod name
node src/getpods.js namespace=production

# Step 2 — open a shell
node src/exec.js namespace=production podname=my-api-pod-abc123
```

### Debug a pod that is crashing

```bash
# Step 1 — check recent events to understand why
node src/getevents.js namespace=production

# Step 2 — inject a debug container
node debug.js namespace=production podname=my-api-pod-abc123 debugimage=busybox

# Step 3 — shell into the debug container
node src/exec.js namespace=production podname=my-api-pod-abc123 containername=debugger
```

### Roll out a new image version

```bash
# Update the image tag in a deployment
node src/editdeployment.js \
  namespace=production \
  deploymentname=my-api \
  op=replace \
  path=/spec/template/spec/containers/0/image \
  value=my-registry/my-api:v2.0.0
```

### Scale down for maintenance, then back up

```bash
node src/scaledeployment.js namespace=production deploymentname=my-api replicas=0
# ... perform maintenance ...
node src/scaledeployment.js namespace=production deploymentname=my-api replicas=3
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error: ENOENT: no such file or directory` | kubeconfig not found | Ensure `~/.kube/config` exists or `KUBECONFIG` is set |
| `401 Unauthorized` | Expired or invalid credentials | Re-authenticate with your cloud provider and refresh your kubeconfig |
| `403 Forbidden` | Insufficient RBAC permissions | Ask your cluster admin to grant the required Role/ClusterRole |
| `404 Not Found` | Resource name or namespace typo | Use `getpods.js` / `getnamespaces.js` to verify names |
| `422 Unprocessable Entity` in `debug.js` | `EphemeralContainers` feature gate not enabled | Enable the feature gate or upgrade to Kubernetes ≥ 1.23 (enabled by default) |
| Patch fails with no error message | `replicas` or `value` is missing/invalid | Check that all required `key=value` args are provided |
| Shell session closes immediately | Pod's shell binary not found | Try `shellcommand=/bin/bash` or `shellcommand=/bin/sh` |
| `HTTP protocol is not allowed when skipTLSVerify is not set or false` | kubeconfig `server:` uses plain `http://` | Scripts skip TLS verification by default, so this should not occur. If you set `KUBE_VERIFY_TLS=true`, either switch the server URL to `https://` or unset `KUBE_VERIFY_TLS` |
| Certificate errors (`self-signed certificate`, `unable to verify`) | Cluster uses an untrusted/self-signed cert | Scripts skip verification by default. If you enabled `KUBE_VERIFY_TLS=true`, add the cluster CA to your kubeconfig or unset the variable |
