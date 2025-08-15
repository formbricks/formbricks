{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        helm-with-plugins = (
          pkgs.wrapHelm pkgs.kubernetes-helm {
            plugins = with pkgs.kubernetes-helmPlugins; [
              helm-secrets
              helm-diff
              helm-s3
              helm-git
            ];
          }
        );
        helmfile-with-plugins = pkgs.helmfile-wrapped.override {
          inherit (helm-with-plugins) pluginsDir;
        };
      in
      with pkgs;
      {
        devShells.default = mkShell {
          buildInputs = [
            awscli
            kubectl
            helm-with-plugins
            helmfile-with-plugins
            terraform
          ];
        };
      }
    );
}
