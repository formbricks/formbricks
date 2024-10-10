import fs from "fs-extra";
import path from "path";
import { Plugin, ResolvedConfig } from "vite";

interface CopyCompiledAssetsPluginOptions {
  filename: string;
  distDir: string;
}

export function copyCompiledAssetsPlugin(options: CopyCompiledAssetsPluginOptions): Plugin {
  let config: ResolvedConfig;

  return {
    name: "copy-compiled-assets",
    apply: "build",

    configResolved(_config) {
      config = _config;
    },

    async writeBundle() {
      const outputDir = path.resolve(config.root, "../../apps/web/public/js");
      const distDir = path.resolve(config.root, options.distDir);

      // Create the output directory if it doesn't exist
      fs.ensureDirSync(outputDir);
      console.log(`Ensured directory exists: ${outputDir}`);

      // Copy files from distDir to outputDir
      const filesToCopy = fs.readdirSync(distDir);
      filesToCopy.forEach((file) => {
        const srcFile = path.resolve(distDir, file);
        const destFile = path.resolve(outputDir, file.replace("index", options.filename));
        fs.copyFileSync(srcFile, destFile);
      });

      console.log(`Copied ${filesToCopy.length} files to ${outputDir} (${options.filename})`);
    },
  };
}
