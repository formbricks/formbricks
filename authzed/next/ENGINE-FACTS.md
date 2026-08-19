# Verified SpiceDB engine facts

Everything below was **executed**, not inferred, against the pinned `authzed/zed:v1.1.1` image — the
same pin `authzed/validate.sh` and `docker-compose.dev.yml` use. Reproduce with
`bash authzed/next/validate.sh`.

Baseline first: the existing parity suite is green and untouched —
`Success! - 36 relationships loaded, 157 assertions run, 6 expected relations validated`.

---

## 1. A heterogeneous relation is legal, but an arrow over it silently drops `user` subjects

This is the most important finding, because the obvious way to write "a container is owned by an
organization **or** a team **or** a user" is a trap that `zed validate` accepts.

```zed
definition container {
    relation owner: organization | team | user
    permission manage: user = owner->manage      // compiles fine under `use typechecking`
}
```

`zed validate` reports **Success** on this schema. But `container:personal#owner@user:bo` grants Bo
**nothing** — asserting `container:personal#manage@user:bo` fails with:

```
error: Expected relation or permission container:personal#manage@user:bo to exist
  ⨉ container:personal manage
```

An arrow walks the _object_ of each subject and asks it for the named permission. `user` has no
`manage`, so user-typed subjects contribute nothing and the schema is quietly wrong. **A schema that
validates is not a schema that works** — this is exactly the class of bug the `validation:`
expected-relations block exists to catch.

**The working pattern is split relations plus a union:**

```zed
definition container {
    relation owner_organization: organization
    relation owner_team: team
    relation owner_user: user
    permission manage: user = owner_user
                            + owner_organization->manage
                            + owner_team->manage
}
```

Verified: `personal#manage@user:bo` ✅, `teamspace#manage@user:tina` ✅ (via team),
`teamspace#manage@user:olivia` ✅ (via org admin), and — the property that makes "private" honest —
**`personal#manage@user:olivia` is denied**: an org admin does _not_ reach a user-owned container
unless we deliberately give them a path. Transfer-without-read is therefore expressible structurally,
not as an application rule.

## 2. Relationship expiration is native and works

```zed
use expiration
definition survey {
    relation viewer: user | user with expiration
    permission read: user = viewer
}
```

`survey:s1#viewer@user:agnes[expiration:2030-01-01T00:00:00Z]` grants access; the same tuple dated
`2020-01-01T00:00:00Z` is **denied**. Un-expiring grants coexist on the same relation.

This closes **I-5 (no expiry anywhere)** with the engine feature rather than a caveat or an
application-side sweep — which is what AuthZed's own best practice #27 asks for.

## 3. Nested containers work, flow downward only, and cost nothing to carry

Three levels (`division_eu` → `germany` → `munich`) with a survey at the leaf:

```zed
definition container {
    relation organization: organization
    relation parent: container
    relation reader_team: team#member
    relation writer_team: team#member

    permission manage: user = organization->manage + parent->manage
    permission write:  user = writer_team + manage + parent->write
    permission read:   user = reader_team + write  + parent->read
}
```

Verified: a `reader_team` grant on `division_eu` reaches `survey:pulse` three levels down ✅; a
`writer_team` grant on `munich` does **not** leak upward to `germany` or `division_eu` ✅; the org
admin reaches everything ✅. Self-recursion on one relation is fine — AuthZed only warns about
_indirect_ cycles.

The practical consequence: carrying an unused `parent` relation costs one nullable column and three
`+ parent->…` terms. Adding it later means re-deriving every permission and re-backfilling the graph.
