/* eslint-disable no-console -- Console logs are allowed for plguins*/
import { access, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { type Plugin, type ResolvedConfig } from "vite";

interface CopyCompiledAssetsPluginOptions {
  filename: string;
  distDir: string;
}

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await access(dirPath);
  } catch (error) {
    if ((error as { code: string }).code === "ENOENT") {
      await mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

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
      // fs.ensureDirSync(outputDir);
      await ensureDirectoryExists(outputDir);
      console.log(`Ensured directory exists: ${outputDir}`);

      // Copy files from distDir to outputDir
      const filesToCopy = await readdir(distDir);

      for (const file of filesToCopy) {
        const srcFile = path.resolve(distDir, file);
        const destFile = path.resolve(outputDir, file.replace("index", options.filename));
        // Check if the srcFile is a regular file before copying
        const fileStat = await stat(srcFile);
        if (!fileStat.isFile()) {
          continue; // Skip directories, or other non-regular files
        }

        await copyFile(srcFile, destFile);
      }

      console.log(`Copied ${filesToCopy.length.toString()} files to ${outputDir} (${options.filename})`);
    },
  };
}
