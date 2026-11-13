# Hosting the media on `assets-pr-screenshots`

One orphan branch holds every PR's media, one directory per change. It never merges into `main` and no PR
targets it — that is the point: the binaries stay out of the history everyone clones.

## Directory name

`ENG-<id>` when there is a Linear ticket, `pr-<number>` when there is not. Prefer the ticket: it exists
*before* the PR does, so you can push the media first and open the PR with its final body in one pass,
instead of opening with a placeholder and editing it after `gh pr view --json number -q .number`. Keep the
ticket id upper-case exactly as Linear writes it — these become URL path segments.

```
assets-pr-screenshots
├── ENG-1234/
│   ├── actions-before.png
│   ├── actions-after.png
│   ├── filters.gif
│   └── filters.mp4
└── pr-8803/
    └── draft-filtering-before-after.png
```

## Push from a worktree

A worktree under the gitignored `.local/` keeps your working tree, your dev server and your node_modules
links untouched. **First time**, when the branch does not exist yet:

```bash
git worktree add --orphan -b assets-pr-screenshots .local/pr-assets
```

**Afterwards**, in a fresh clone or after a `git worktree remove`:

```bash
git fetch origin assets-pr-screenshots && git worktree add .local/pr-assets assets-pr-screenshots
```

Either way the commit is the same, and `git status` in the main tree never moves:

```bash
mkdir -p .local/pr-assets/ENG-1234
cp /tmp/shots/*.png /tmp/shots/*.gif /tmp/shots/*.mp4 .local/pr-assets/ENG-1234/
git -C .local/pr-assets pull --ff-only          # skip on the very first push
git -C .local/pr-assets add ENG-1234
git -C .local/pr-assets commit -m "assets: screenshots for ENG-1234"
git -C .local/pr-assets push -u origin assets-pr-screenshots
```

`git switch assets-pr-screenshots` in the main tree is the wrong tool: it only works on a clean tree — so
never mid-change — and it invalidates the running dev server and every generated artifact.

The branch is **append-only**. Never rewrite or delete an existing directory: merged PRs still link to
those files, and a dead image is worse than no image. The repo also carries older one-off `assets-*` and
`assets/*` branches from before this convention; leave them alone and do not add more.

## URLs

```
https://raw.githubusercontent.com/formbricks/formbricks/assets-pr-screenshots/ENG-1234/actions-after.png
https://github.com/formbricks/formbricks/blob/assets-pr-screenshots/ENG-1234/filters.mp4
```

Embed images from `raw.githubusercontent.com`; link non-images to the `blob` page. Confirm the owner and
repo from `git remote -v` rather than assuming — a fork's raw URLs are not `formbricks/formbricks`.
