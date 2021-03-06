/*!
GPII Grunt shared tasks

Copyright 2014 RTF-US

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/universal/LICENSE.txt
*/

"use strict";

module.exports = function (grunt) {
    var path = require("path"),
        _ = grunt.util._; // for _.merge - we can't load Infusion since we are probably trying to resolve it during the build
 
        
    var default_options = {
        node_modules: "./node_modules",
        universal: "../node_modules/universal",
        universalRepoURL: "git://github.com/GPII/universal.git"
    };
   
    // Subvert the grunt plugin system by creating a single, global, well-known namespace for shared grunt utility functions
    
    var gpiiGrunt = {
        defaults: {
            shell: {
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                }
            },
            "dedupe-infusion": {
                options: {
                    node_modules: "./node_modules"
                }
            }
        }
    };
    
    // Subvert the grunt invocation system by accepting a complex argument and stuffing it into the config's options for the task
    // We can't invoke task functions directly since grunt queues them async
    
    gpiiGrunt.runTask = function (type, options) {
        var holder = grunt.config.get(type) || {};
        options = _.merge({}, gpiiGrunt.defaults[type], options);
        if (options.name) {
            holder[options.name] = options;
        } else {
            holder = options;
        }
        grunt.config.set(type, holder);
        grunt.task.run(type + (options.name ? ":" + options.name : ""));
    };
    
    grunt.registerTask("dedupe-infusion", "Remove duplicate copies of infusion", function () {
        var options = this.options(gpiiGrunt.defaults["dedupe-infusion"].options);
        var node_modules = options.node_modules;
        var infusions = grunt.file.expand({
            cwd: node_modules
        }, "**/infusion");
        grunt.log.ok("Found " + infusions.length + " infusions");
        var infusionSegs = infusions.map(function (onePath) {
            // Whilst the "path" module exports an entry "path.sep" purportedly holding this path separator,
            // in practice this is not the one used by the grunt file expander
            return onePath.split("/");
        });
        // Locate the copy of infusion at the shortest path depth
        infusionSegs.sort(function (a, b) {
            return a.length - b.length;
        });
        infusions = infusionSegs.map(function (oneSegs) {
            return oneSegs.join("/");
        });
        if (infusionSegs.length === 0) {
            grunt.log.error("Warning - no instances of Infusion library discovered in " + path.resolve(node_modules));
        }
        if (infusionSegs.length > 2 && infusionSegs[0] === infusionSegs[1]) {
            grunt.log.error("Warning - found two instances of Infusion at the same path depth: " + infusions[0] + " and " + infusions[1] + ": deleting the second arbitrarily");
        }
        for (var i = 1; i < infusions.length; i++) {
            var toDelete = node_modules + "/" + infusions[i];
            grunt.log.ok("Deleting " + toDelete);
            grunt.file["delete"](toDelete, { force: true });
        }
    });
    
    gpiiGrunt.shellImmediate = function (options) {
        if (!options.name || !options.command) {
            grunt.log.error("shellImmediate task must have options \"name\" and \"command\"");
        }
        options = _.merge({ // Oh for a Model Transformations framework
            options: {
                execOptions: {
                    cwd: options.cwd
                }
            }
        }, options);
        gpiiGrunt.runTask("shell", options);
    };
    
    gpiiGrunt.gitClone = function (options) {
        var gitOptions = options.fastClone ? " --depth=1" : "";
        var gitCommand = "git clone " + gitOptions + " " + options.repoURL + " " + options.localPath;
        gpiiGrunt.shellImmediate({
            name: "git-clone",
            command: gitCommand
        });
    };
    
    grunt.registerTask("npm-install", "Reinstall some npm dependencies based on this project's package.json", function () {
        var pkg = gpiiGrunt.packageFile;
        for (var i = 0; i < arguments.length; ++ i) {
            var dep = arguments[i];
            var entry = pkg.dependencies[dep] || pkg.devDependencies[dep];
            if (!entry) {
                grunt.log.error("Package " + dep + " doesn't match any dependency in this project's dependencies or devDependencies (check package.json)");
            }
            var installArg = entry.indexOf("git://") === 0 ? entry : dep + "@\"" + entry + "\"";
            gpiiGrunt.shellImmediate({
                name: "npm-install",
                command: "npm install " + installArg
            });
        }
    });
    
    grunt.registerTask("gpii-universal", "Fetch and Install Universal", function () {
        var options = this.options(default_options);

        grunt.file.mkdir(options.node_modules);
        
        gpiiGrunt.gitClone({
            fastClone: grunt.option("fastClone"),
            repoURL: options.universalRepoURL,
            localPath: options.universal
        });

        gpiiGrunt.shellImmediate({
            name: "npm-install",
            command: "npm install",
            cwd: options.universal
        });
        
        gpiiGrunt.runTask("dedupe-infusion", {
            options: {
                node_modules: "../node_modules"
            }
        });
    });

    grunt.registerTask("lint", "Apply jshint and jsonlint", ["jshint", "jsonlint"]);
    
    var packageFile = grunt.file.readJSON("package.json");
    
    gpiiGrunt.packageFile = packageFile;
    
    // Advertise our subversive package in the global configuration
    grunt.config.set("gpiiGruntGlobal", gpiiGrunt);
};
