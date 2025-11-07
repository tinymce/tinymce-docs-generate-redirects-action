import commonjs from "@rollup/plugin-commonjs";
import json from '@rollup/plugin-json';
import { nodeResolve } from "@rollup/plugin-node-resolve";

const config = {
  input: "src/index.mjs",
  output: {
    esModule: true,
    file: "dist/index.js",
    format: "es",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  plugins: [json(), commonjs(), nodeResolve({ preferBuiltins: true })],
};

export default config;