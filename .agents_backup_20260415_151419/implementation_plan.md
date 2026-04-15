# Workspace Alignment with Agent Rules

Aligning the `trading-workspace` with the architectural guardrails and project context defined in the [Gemini instructions](https://gemini.google.com/share/a4f710b31fcc).

## User Review Required

> [!IMPORTANT]
> The architectural rules specify a root structure of `algo-trader/`, `openalgo/db/`, and `openclaw/`. Currently, the workspace uses a `data/` folder for `openclaw` and Docker volumes for `openalgo`. I propose migrating these to the root structure as defined.

> [!CAUTION]
> Changing `openalgo_db` from a named volume to a host bind mount (`openalgo/db/`) requires manual data migration if there is existing state. I will assume we want to align with the "relative path" rule and "777 permission" rule which implies host-level access.

## Proposed Changes

### [Component Name] Docker Infrastructure

#### [MODIFY] [docker-compose.yml](file:///home/ubuntu/trading-workspace/docker-compose.yml)
- Add `deploy: resources: limits: memory: 1G` to the `algo-trader` service.
- Update volumes for `openalgo` and `openclaw` services to use the root-level directories (`./openalgo/db` and `./openclaw`) instead of named volumes or `./data/`.

#### [NEW] [openalgo/db/](file:///home/ubuntu/trading-workspace/openalgo/db/)
- Create the directory to store SQLite databases.

#### [NEW] [openclaw/](file:///home/ubuntu/trading-workspace/openclaw/)
- Create the directory for OpenClaw configuration (migrating from `data/openclaw`).

---

### [Component Name] Agent Context

#### [NEW] [.agents-rules](file:///home/ubuntu/trading-workspace/.agents-rules)
- (Already created) Persistent context for future agent interactions.

---

## Open Questions
- **Data Migration**: Do you want me to migrate current data from the `openalgo_db` volume and `data/openclaw` directory to the new structure, or start fresh?
- **RAM Limit**: The `algo_engine` limit is set to 1GB. Should I apply this via Docker Compose `deploy` settings (which require Swarm or `docker-compose` v3+ context)?

## Verification Plan

### Automated Tests
- `docker-compose config` to verify syntax.
- Check directory permissions with `ls -ld openalgo/db`.

### Manual Verification
- Restart services and check if `algo_engine` starts with the memory limit.
- Verify that `openalgo.db` is accessible and writable in the new path.
