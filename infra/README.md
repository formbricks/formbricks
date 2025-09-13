### Nix Flakes

This project uses Nix Flakes via direnv.

Ensure your `~/.config/nix/nix.conf` (or `/etc/nix/nix.conf`) contains:

```bash
experimental-features = nix-command flakes
```

If your environment does not support flakes, you can still enter the development shell with:

```bash
nix develop
```
