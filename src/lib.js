//
// Shared helpers for the kubetools CLI scripts.
//
// Every script uses these so they all behave consistently:
//   - same argument precedence: built-in defaults < environment variables < command-line key=value
//   - same help flags: -h, --help, help
//   - same usage / help message format
//

// Force the loaded kubeconfig to skip TLS certificate verification for every
// cluster. Call this right after kc.loadFromDefault(). This makes the scripts
// tolerate self-signed / untrusted cluster certificates by default, and also
// avoids the v1.x client error "HTTP protocol is not allowed when skipTLSVerify
// is not set or false" for plain-http servers.
//
// Set the environment variable KUBE_VERIFY_TLS=true (or 1/yes) to opt back in to
// normal certificate verification.
function verifyTlsRequested() {
    const v = String(process.env.KUBE_VERIFY_TLS || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
}

function skipTlsVerify(kc) {
    if (verifyTlsRequested()) {
        return kc;
    }
    if (!kc || !Array.isArray(kc.clusters)) {
        return kc;
    }
    // Cluster objects are typed readonly, so replace each with a copy that has
    // skipTLSVerify enabled rather than mutating in place.
    kc.clusters = kc.clusters.map((c) => Object.assign({}, c, { skipTLSVerify: true }));
    return kc;
}

function wantsHelp(argv) {
    argv = argv || process.argv.slice(2);
    return argv.some((a) => a === "-h" || a === "--help" || a === "help");
}

// Apply environment variables, then command-line key=value pairs, over the
// supplied defaults object (mutated in place and returned).
function applyArgs(context, argv) {
    argv = argv || process.argv.slice(2);
    // Environment variables override the built-in defaults.
    Object.keys(context).forEach((k) => {
        if (process.env[k] !== undefined) {
            context[k] = process.env[k];
        }
    });
    // Command-line key=value pairs override everything above.
    argv.forEach((a) => {
        const idx = a.indexOf("=");
        if (idx === -1) {
            return;
        }
        const name = a.substring(0, idx);
        context[name] = a.substring(idx + 1);
    });
    return context;
}

function formatDefault(value) {
    if (value === "" || value === undefined) {
        return "(empty)";
    }
    if (value === null) {
        return "(none)";
    }
    return String(value);
}

function formatUsage(spec) {
    const name = spec.name;
    const description = spec.description || "";
    const context = spec.context || {};
    const options = spec.options || {};
    const examples = spec.examples || [];

    const lines = [];
    lines.push(`Usage: node src/${name} [key=value ...]`);
    if (description) {
        lines.push("");
        lines.push(description);
    }

    const keys = Object.keys(context);
    if (keys.length) {
        const width = Math.max.apply(null, keys.map((k) => k.length));
        lines.push("");
        lines.push("Options (key=value, also settable via an environment variable of the same name):");
        keys.forEach((k) => {
            const desc = options[k] ? `  - ${options[k]}` : "";
            lines.push(`  ${k.padEnd(width)}  [default: ${formatDefault(context[k])}]${desc}`);
        });
    }

    lines.push("");
    lines.push("Precedence: built-in defaults < environment variables < command-line key=value.");
    lines.push("Help: pass -h, --help, or help to show this message.");

    if (examples.length) {
        lines.push("");
        lines.push("Examples:");
        examples.forEach((e) => lines.push(`  ${e}`));
    }

    return lines.join("\n");
}

function printUsage(spec) {
    console.log(formatUsage(spec));
}

// Standard entry point for a script. If the user asked for help, print usage and
// exit; otherwise resolve the configuration (defaults < env < CLI) and return it.
function init(spec) {
    if (wantsHelp()) {
        printUsage(spec);
        process.exit(0);
    }
    return applyArgs(spec.context || {});
}

module.exports = { wantsHelp, applyArgs, formatUsage, printUsage, init, skipTlsVerify, verifyTlsRequested };
