# Security and demo boundaries

Use fictional information. This public portfolio demo is not a production service or a destination for sensitive personal data. Report issues privately through the repository owner's GitHub profile; never paste credentials or private records into a public issue.

The server validates bounded JSON payloads, keeps database credentials in server environment settings, uses unguessable bearer tokens stored as hashes, and rejects expired records. Updates use a revision check to avoid silently losing concurrent changes. Server error responses do not expose database diagnostics. Frontend user content is rendered as text, and a restrictive content security policy is supplied on Azure.

Rate limits are per function process, supplemented by per-workspace/room record limits and collection capacity checks. They are not a distributed DDoS defense. The demo uses the existing free service limits; do not upgrade a plan or raise throughput automatically.

Weekly Dependabot updates and CI dependency audits monitor the maintained repository. Passing tests and audits do not guarantee that all security defects have been found. Original historical repositories keep their old dependencies and are not copied into deployment artifacts.
