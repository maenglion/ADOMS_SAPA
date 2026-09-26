import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts_loader_hooks.mjs", pathToFileURL(import.meta.filename));
