# Cloud sign-up email-domain lists

Formbricks Cloud rejects sign-ups (credential, SSO) and email changes from personal, free and
disposable email domains. `../signup-email-domain.ts` loads these files. Self-hosted instances never
apply them.

| File                         | Edited by          | What it holds                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `free-provider-domains.json` | the refresh script | Personal mailbox, ISP and alias/forwarding providers from [`disposable/static-disposable-lists` `mailservices.json`](https://github.com/disposable/static-disposable-lists/blob/master/mailservices.json)                                                                  |
| `disposable-domains.json`    | the refresh script | [`disposable/disposable-email-domains` `domains_mx.txt`](https://github.com/disposable/disposable-email-domains) (burner domains with working DNS) and the curated [`disposable-email-domains`](https://github.com/disposable-email-domains/disposable-email-domains) list |
| `sources.json`               | the refresh script | The upstream commit each list was built from, and the entries it dropped                                                                                                                                                                                                   |
| `blocked-domains.json`       | us                 | Domains upstream misses, each with a reason                                                                                                                                                                                                                                |
| `allowed-domains.json`       | us                 | False positives to let through, each with a reason. Wins over every other list                                                                                                                                                                                             |

An entry blocks the domain and all of its subdomains.

## Refreshing

`.github/workflows/refresh-email-domain-lists.yml` runs `scripts/email-domain-lists/refresh.mjs` every
Monday and opens a pull request when an upstream list changed. The PR body lists what was added and
removed, local blocks that upstream now covers (delete them), and allowlisted domains that upstream
started blocking. To run it by hand:

```bash
GITHUB_TOKEN=$(gh auth token) node scripts/email-domain-lists/refresh.mjs
```

The script drops upstream entries that are public suffixes (subdomain matching would block a whole
namespace such as `ddns.net`), malformed, or longer than six labels. It refuses to write anything when
a source shrank past its limit, `mailservices.json` uses a type or cost it does not know, or the local
lists contain a contradiction, duplicate, public suffix or missing reason.

## Fixing a false positive or a miss

- **A real company is blocked:** add its domain to `allowed-domains.json` with the reason. Consider
  reporting it upstream too.
- **A personal or burner domain gets through:** add it to `blocked-domains.json` with the reason. The
  next refresh PR tells you when upstream covers it, so the entry can go.
