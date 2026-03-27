# kubetools — Documentation

A collection of Node.js scripts that replicate the most common `kubectl` operations via the official `@kubernetes/client-node` SDK. Each script is self-contained, reads your local kubeconfig automatically, and accepts parameters from the command line.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [How Arguments Work](#how-arguments-work)
- [Scripts](#scripts)
  - [apply.js — Apply YAML resources](#applyjs--apply-yaml-resources)
  - [describe.js — Describe a deployment](#describejs--describe-a-deployment)
  - [editdeployment.js — Patch a deployment](#editdeploymentjs--patch-a-deployment)
  - [exec.js — Open a shell in a pod](#execjs--open-a-shell-in-a-pod)
  - [debug.js — Attach an ephemeral debug container](#debugjs--attach-an-ephemeral-debug-container)
  - [getevents.js — List namespace events](#geteventsjs--list-namespace-events)
  - [getnamespaces.js — List namespaces](#getnamespacesjs--list-namespaces)
  - [getpods.js — List pods in a namespace](#getpodsjs--list-pods-in-a-namespace)
  - [scaledeployment.js — Scale a deployment or StatefulSet](#scaledeploymentjs--scale-a-deployment-or-statefulset)
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

Each script defines a `CONTEXT` object with default values. Any `key=value` pair on the command line **overrides** the matching key in `CONTEXT`. This means you can always run a script without arguments to use its built-in defaults, or supply only the parameters you want to change.

**Example:**

```bash
# Uses defaults (namespace=ns-dev, mode=default)
node src/getpods.js

# Override just the namespace
node src/getpods.js namespace=production

# Override multiple values
node src/getpods.js namespace=production mode=verbose
```

> **Note:** Values that contain spaces or special characters should be quoted in your shell, e.g. `value="my long string"`. The `editdeployment.js` script additionally strips leading/trailing double-quotes from values automatically.

---

## Scripts

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

**Error handling:**

| Error | Cause |
|---|---|
| `404 Not Found` | The pod name does not exist in that namespace |
| `422 Unprocessable Entity` | The cluster does not have the `EphemeralContainers` feature gate enabled |

---

### `getevents.js` — List namespace events

**Equivalent to:** `kubectl get events -n <namespace>`

Lists all Kubernetes events in a given namespace, printing the type, reason, message, and the object the event relates to.

**Arguments:**

Unlike other scripts, `getevents.js` takes a single positional argument (not a `key=value` pair):

```bash
node src/getevents.js <namespace>
```

**Default:** `ns-test`

**Usage:**

```bash
# Use default namespace
node src/getevents.js

# Specify namespace positionally
node src/getevents.js production
```

**Example output:**

```
Kubernetes Events in "production" namespace:
 - Type: Warning, Reason: BackOff, Message: Back-off restarting failed container, Involved Object: Pod/my-api-abc
 - Type: Normal, Reason: Pulled, Message: Successfully pulled image "my-image:latest", Involved Object: Pod/my-api-def
```

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
node src/getevents.js production

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
