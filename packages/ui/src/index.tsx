var fs = require("fs");

export * from "./Button";

// export all icons
fs.readdirSync("./icons").forEach(function (file) {
  if (file.indexOf(".js") > -1 && file != "index.js") exports[file.replace(".js", "")] = require("./" + file);
});
